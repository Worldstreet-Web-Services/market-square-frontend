"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { houseTopic, parseParticipantMeta, participantName } from "@/features/houses";
import { useEndStream, useStageSlots } from "@/features/streams";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmSheet } from "@/components/ui/destructive-confirm-sheet";
import { IconChevronUp, IconLock, IconRefresh, IconVolume, IconX } from "@/components/ui/icons";
import { IconRoomLeave, IconRoomMic, IconRoomMicOff } from "@/components/ui/room-icons";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { useChatOpen } from "@/lib/chat-open-store";
import { micControl } from "@/lib/mic-consent";
import { setMiniPlayer, useRoomBar } from "@/lib/room-bar-store";
import { useRoomSession, type RoomSessionView } from "@/lib/room-session-store";
import { miniPlayerChrome, miniPlayerVisible, roomChipVisible } from "@/lib/room-session/visibility";
import { sq, stripSquare } from "@/lib/square-path";

/**
 * THE MINIMISED GIST ROOM.
 *
 * The room keeps playing wherever the reader goes inside the Square (the
 * shell's RoomSessionProvider owns the call); this is how they see it, talk in
 * it and get back to it. Rendered by AppShell — never by a route — in three
 * placements that share one body:
 *
 *   · `phone` — a 56px bar ABOVE the dock, safe-area aware. It rings
 *     `setMiniPlayer`, and the shell stamps `data-mini-player` so the
 *     stylesheet adds its height to `--ws-nav-h` and to the floating `+`
 *     offsets: nothing scrolls under it and no button sits on it. Where the
 *     bar steps aside (an open chat thread, another room's own bar) a compact
 *     chip takes its place in EVERY state — listening, failed, ended, another
 *     tab, a publisher's mic — with the same state line, Retry, Dismiss, mic
 *     and hang-up, up top where the keyboard and the composer cannot reach.
 *   · `card` — a 320px card at the bottom-left on desktop when the rail is off
 *     (guests included), clear of the centred dock. While a chat thread is
 *     open there is no dock and the thread's composer owns the foot, so the
 *     card moves to the top-right of the thread instead.
 *   · `rail` — the rail's foot when the rail is on.
 *
 * States: Connecting, Reconnecting, Room ended (cleared after 5 s by the
 * provider), Playing in another tab, Tap to listen.
 * What is drawn reads the CONNECTION (lib/room-session/visibility.ts
 * `miniPlayerChrome`), never the open "join another room?" question — which
 * used to hide the mic, the live badge and Retry for as long as it stood.
 * A publisher gets the mic toggle and, while it is open, "You're live" in the
 * state line — a hot mic somewhere the reader cannot see is the one thing
 * this bar must never let them forget. It is a badge beside the title, not a
 * pill among the controls: there it pushed the title to nothing and the
 * hang-up off the rail.
 *
 * FITTING THE FRAME. The labelled rail stacks the title over a control row
 * that wraps; a phone draws Listen and Retry as icons and never more than
 * three trailing controls; the icon rail's frame drops its border and side
 * padding so 44px targets fit its 48px column. Every control is a 44px target
 * under a coarse pointer at any width (a tablet is touch too) and shrinks to
 * its 36px circle only under a fine one; one always-mounted live region
 * announces the state and the mic.
 *
 * After a reload there is no session (nobody's call resumes without them), so
 * the same placement offers "Tap to rejoin <room>" instead.
 */
type Placement = "phone" | "card" | "rail";

/** Before the bar unmounts under the reader's focus: land it somewhere stable. */
function keepFocus() {
  const main = document.querySelector("main");
  if (!(main instanceof HTMLElement)) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.focus({ preventScroll: true });
}

export function RoomMiniPlayer({ placement }: { placement: Placement }) {
  const session = useRoomSession();
  const pathname = stripSquare(usePathname());
  const chatOpen = useChatOpen();
  const roomBar = useRoomBar();
  const phone = useMediaQuery("(max-width: 767px)");
  const onPhone = placement === "phone";
  const streamId = session.state.target?.streamId ?? null;
  const where = {
    pathname,
    session: { status: session.state.status, streamId },
    chatOpen,
    isPhone: phone,
    roomBarUp: roomBar,
  };
  const visible = onPhone === phone && miniPlayerVisible(where);
  const chip = onPhone && phone && roomChipVisible(where);

  const offer = session.rejoinOffer;
  const offering =
    onPhone === phone &&
    !visible &&
    session.state.status === "idle" &&
    offer !== null &&
    pathname !== `/gist-rooms/${offer.streamId}` &&
    !(phone && (chatOpen || roomBar));

  // Only the phone bar moves the layout; the desktop placements and the chip float.
  const up = onPhone && (visible || offering);
  useEffect(() => {
    if (!onPhone) return;
    setMiniPlayer(up);
    return () => setMiniPlayer(false);
  }, [onPhone, up]);

  if (offering && offer) {
    const label = `Tap to rejoin ${offer.title || "your gist room"}`;
    return (
      <Frame placement={placement} chatOpen={chatOpen} announcement={label}>
        <Link
          href={sq(`/gist-rooms/${offer.streamId}`)}
          onClick={() => session.dismissRejoin()}
          aria-label={label}
          title={label}
          className={cn(
            "ws-press flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-full px-1 text-left pointer-fine:min-h-9",
            RAIL_ICON_LINK
          )}
        >
          {/* Static, not the live pulse: nothing has checked the room is still open. */}
          <span className="h-2 w-2 shrink-0 rounded-full bg-grey-400" aria-hidden />
          <span className="min-w-0 flex-1 group-data-[rail=icon]/rail:hidden">
            <span className="block text-[11px] font-semibold uppercase leading-4 tracking-[0.04em] text-grey-400">
              Tap to rejoin
            </span>
            <span className="block truncate text-[13px] font-bold leading-5 text-heading">
              {offer.title || "Your gist room"}
            </span>
          </span>
        </Link>
        <Controls>
          <RoundButton
            label="Dismiss"
            onClick={() => {
              keepFocus();
              session.dismissRejoin();
            }}
          >
            <IconX className="h-3.5 w-3.5" />
          </RoundButton>
        </Controls>
      </Frame>
    );
  }

  if (chip && streamId) return <RoomChip session={session} streamId={streamId} chatOpen={chatOpen} />;
  if (!visible || !streamId) return null;
  return <PlayerBody placement={placement} session={session} streamId={streamId} chatOpen={chatOpen} />;
}

/**
 * The icon rail is 72px: the return link collapses to a 40px round target
 * (the status dot inside it), never to the bare 8px dot.
 */
const RAIL_ICON_LINK =
  "group-data-[rail=icon]/rail:h-10 group-data-[rail=icon]/rail:w-10 group-data-[rail=icon]/rail:min-h-0 group-data-[rail=icon]/rail:flex-none group-data-[rail=icon]/rail:justify-center group-data-[rail=icon]/rail:bg-white/[0.06] group-data-[rail=icon]/rail:px-0";

function PlayerBody({
  placement,
  session,
  streamId,
  chatOpen,
}: {
  placement: Placement;
  session: RoomSessionView;
  streamId: string;
  chatOpen: boolean;
}) {
  const router = useRouter();
  const { state, stream, presence, room } = session;
  const slots = useStageSlots(room, stream?.ownerId ?? "");
  const chrome = miniPlayerChrome({ state, presence, micOn: session.micOn, canPlayAudio: session.canPlayAudio });
  const { line, publishing, finished } = chrome;

  const title = stream ? houseTopic(stream) : "Gist room";
  const roomHref = sq(`/gist-rooms/${streamId}`);
  const faces = slots.slice(0, 3);

  return (
    <Frame placement={placement} chatOpen={chatOpen} announcement={chrome.announcement}>
      {/* Back to the room: the whole identity block, so the target is large. */}
      <Link
        href={roomHref}
        aria-label={line ? `Return to ${title}, ${line}` : `Return to ${title}`}
        title={line ? `Return to ${title}, ${line}` : `Return to ${title}`}
        className={cn(
          "ws-press flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full text-left pointer-fine:min-h-9",
          RAIL_ICON_LINK
        )}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            chrome.live ? "ws-live-dot bg-accent" : finished ? "bg-grey-600" : "bg-grey-400"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 group-data-[rail=icon]/rail:hidden">
          <span className="block truncate text-[13px] font-bold leading-5 text-heading">{title}</span>
          {line && !chrome.liveBadge ? (
            <span
              className={cn(
                "block truncate text-[11px] font-semibold leading-4",
                chrome.retry || state.connection === "reconnecting" ? "text-grey-300" : "text-grey-400"
              )}
            >
              {line}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              {chrome.liveBadge && (
                <span className="flex h-4 shrink-0 items-center gap-1 rounded-full bg-white px-1.5 text-[10px] font-bold leading-none text-ink">
                  <span className="ws-live-dot h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
                  You&apos;re live
                </span>
              )}
              {faces.length > 0 && (
                <span className="flex -space-x-1.5" aria-hidden>
                  {faces.map((slot) => {
                    const owner = slot.role === "host" ? stream?.owner : null;
                    const meta = parseParticipantMeta(slot.metadata);
                    return (
                      <span
                        key={slot.identity}
                        className={cn(
                          "rounded-full ring-2 ring-chrome",
                          slot.isSpeaking && "ring-accent"
                        )}
                      >
                        <Avatar
                          name={owner?.displayName ?? participantName(slot.name) ?? slot.name}
                          seed={owner?.id ?? slot.identity}
                          src={owner?.avatarUrl ?? meta?.avatarUrl ?? null}
                          size={16}
                        />
                      </span>
                    );
                  })}
                </span>
              )}
              <span className="truncate text-[11px] font-semibold leading-4 text-grey-400">
                {room ? `${room.numParticipants} in the room` : "Live"}
              </span>
            </span>
          )}
        </span>
      </Link>

      <Controls>
        {/* "Tap to listen": the browser refused to autoplay, and this tap is the
            gesture it wants. A glyph on a phone and in the icon rail, where a
            text button squeezed the title to nothing. */}
        {chrome.listen &&
          (placement === "phone" ? (
            <RoundButton label="Tap to listen" onClick={session.startAudio}>
              <IconVolume className="h-4 w-4" />
            </RoundButton>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={session.startAudio} className="shrink-0 pointer-coarse:h-11 group-data-[rail=icon]/rail:hidden">
                Listen
              </Button>
              {placement === "rail" && (
                <RoundButton label="Tap to listen" onClick={session.startAudio} className="hidden group-data-[rail=icon]/rail:grid">
                  <IconVolume className="h-4 w-4" />
                </RoundButton>
              )}
            </>
          ))}

        {chrome.retry &&
          (placement === "phone" ? (
            <RoundButton label="Retry the connection" onClick={session.retry}>
              <IconRefresh className="h-4 w-4" />
            </RoundButton>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={session.retry} className="shrink-0 pointer-coarse:h-11 group-data-[rail=icon]/rail:hidden">
                Retry
              </Button>
              {placement === "rail" && (
                <RoundButton label="Retry the connection" onClick={session.retry} className="hidden group-data-[rail=icon]/rail:grid">
                  <IconRefresh className="h-4 w-4" />
                </RoundButton>
              )}
            </>
          ))}

        {publishing && <MicButton session={session} />}

        {finished ? (
          <DismissButton session={session} />
        ) : (
          <>
            {/* The phone's whole bar is the way back; three trailing controls at most. */}
            {placement !== "phone" && (
              <RoundButton
                label="Return to room"
                onClick={() => router.push(roomHref)}
                className="group-data-[rail=icon]/rail:hidden"
              >
                <IconChevronUp className="h-4 w-4" />
              </RoundButton>
            )}
            <HangUp session={session} streamId={streamId} />
          </>
        )}
      </Controls>
    </Frame>
  );
}

/**
 * THE ROOM, while the phone's bar has stepped aside for an open chat thread or
 * another room's own bar. Up top — under the top strip and the thread's header
 * — where neither the keyboard nor the composer can cover it. Every state gets
 * it (lib/room-session/visibility.ts `roomChipVisible`): a listener must be
 * able to hang up, and a failed or finished room to be retried or dismissed,
 * from inside a DM as much as a publisher must reach an open mic.
 */
function RoomChip({
  session,
  streamId,
  chatOpen,
}: {
  session: RoomSessionView;
  streamId: string;
  chatOpen: boolean;
}) {
  const title = session.stream ? houseTopic(session.stream) : "your gist room";
  const chrome = miniPlayerChrome({
    state: session.state,
    presence: session.presence,
    micOn: session.micOn,
    canPlayAudio: session.canPlayAudio,
  });
  const text = chrome.hotMic ? "You're live" : (chrome.line ?? "In a gist room");
  return (
    <div
      role="region"
      aria-label="Gist room"
      className="ws-glass fixed z-40 flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full border border-white/10 bg-chrome/90 py-0.5 pl-1 pr-0.5 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)] md:hidden"
      style={{
        right: "max(12px, env(safe-area-inset-right, 0px))",
        // Under what it shares the screen with, never over it: a thread's
        // 80px header, or ANOTHER ROOM's sticky header, which publishes its
        // measured height — a fixed 88 sat on that room's title and beside its
        // own red Leave.
        top: chatOpen
          ? "calc(var(--ws-topbar-h) + 88px)"
          : "calc(var(--ws-topbar-h) + var(--ws-house-head-h) + 8px)",
      }}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {chrome.announcement}
      </p>
      <Link
        href={sq(`/gist-rooms/${streamId}`)}
        aria-label={`${text} in ${title}. Return to the room`}
        className="ws-press flex h-11 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold leading-none text-heading"
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            chrome.live ? "ws-live-dot bg-accent" : chrome.finished ? "bg-grey-600" : "bg-grey-400"
          )}
          aria-hidden
        />
        <span className="truncate">{text}</span>
      </Link>
      {chrome.listen && (
        <RoundButton label="Tap to listen" onClick={session.startAudio}>
          <IconVolume className="h-4 w-4" />
        </RoundButton>
      )}
      {chrome.retry && (
        <RoundButton label="Retry the connection" onClick={session.retry}>
          <IconRefresh className="h-4 w-4" />
        </RoundButton>
      )}
      {chrome.publishing && <MicButton session={session} />}
      {chrome.finished ? <DismissButton session={session} /> : <HangUp session={session} streamId={streamId} />}
    </div>
  );
}

/** Clear a finished room (ended, removed, another tab) off the screen. */
function DismissButton({ session }: { session: RoomSessionView }) {
  return (
    <RoundButton
      label="Dismiss"
      onClick={() => {
        keepFocus();
        session.dismiss();
      }}
    >
      <IconX className="h-3.5 w-3.5" />
    </RoundButton>
  );
}

/**
 * THE RED BUTTON, one for the bar and the chip. A listener's leave costs nobody
 * anything and stays one tap; a seated speaker gives up their seat, and the
 * host closes the room for everyone, so both ask first.
 */
function HangUp({ session, streamId }: { session: RoomSessionView; streamId: string }) {
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmLeaveStage, setConfirmLeaveStage] = useState(false);
  const endRoom = useEndStream({ successMessage: "Gist room closed" });
  const { presence } = session;
  // Named, so this red button cannot be mistaken for the one on another room's page.
  const title = session.stream ? houseTopic(session.stream) : "the gist room";

  const leave = () => {
    keepFocus();
    void session.leave();
  };

  return (
    <>
      <RoundButton
        label={presence === "host" ? `Close ${title}` : `Leave ${title}`}
        onClick={() =>
          presence === "host"
            ? setConfirmClose(true)
            : presence === "speaker"
              ? setConfirmLeaveStage(true)
              : leave()
        }
        tone="danger"
      >
        <IconRoomLeave className="h-4 w-4" />
      </RoundButton>

      <DestructiveConfirmSheet
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Close the gist room?"
        body="Everyone will be sent out and the gist room will be closed."
        confirmLabel="Close it"
        loading={endRoom.isPending}
        onConfirm={() =>
          endRoom.mutate(streamId, {
            onSuccess: () => {
              setConfirmClose(false);
              keepFocus();
              void session.end();
            },
          })
        }
      />

      <DestructiveConfirmSheet
        open={confirmLeaveStage}
        onClose={() => setConfirmLeaveStage(false)}
        title="Leave the stage?"
        body="You'll lose your seat. Coming back, you'll need to ask to speak again."
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmLeaveStage(false);
          leave();
        }}
      />
    </>
  );
}

function MicButton({ session }: { session: RoomSessionView }) {
  // One decision for every mic control (lib/mic-consent.ts). The host's hard
  // mute is backend-dependent and reads "none" until it ships; the lock state
  // arrives with it, already drawn.
  const control = micControl({
    hostMuted: "none",
    permissions: { canPublish: !session.micDisabled, microphone: !session.micDisabled },
    micOn: session.micOn,
  });
  return (
    <RoundButton
      label={control.label}
      onClick={() => void session.toggleMic()}
      disabled={control.disabled}
      tone={session.micOn ? "on" : "default"}
    >
      {control.icon === "lock" ? (
        <IconLock className="h-4 w-4" />
      ) : control.icon === "mic" ? (
        <IconRoomMic className="h-4 w-4" />
      ) : (
        <IconRoomMicOff className="h-4 w-4" />
      )}
    </RoundButton>
  );
}

/**
 * A 36px circle in a 44px target on touch (Apple's 44pt, the rule the stage
 * tiles already follow). The target shrinks to the circle only under a FINE
 * pointer — never by width: 768–1023px is an iPad, and a missed tap on the mic
 * there landed on the red button 8px away.
 */
function RoundButton({
  label,
  onClick,
  children,
  disabled = false,
  tone = "default",
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: "default" | "on" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "ws-press group/round grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 pointer-fine:h-9 pointer-fine:w-9",
        className
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full transition-colors",
          tone === "danger"
            ? "bg-danger/[0.13] text-danger group-hover/round:bg-danger/20"
            : tone === "on"
              ? "bg-white text-ink"
              : "bg-white/[0.06] text-heading group-hover/round:bg-white/10"
        )}
      >
        {children}
      </span>
    </button>
  );
}

/**
 * The trailing controls. Inline on the phone bar and the card; in the
 * labelled rail a row of its own under the title that wraps rather than
 * pushing the hang-up past the aside's clipped edge; a column in the icon rail.
 */
function Controls({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 max-md:gap-3 group-data-[rail=icon]/rail:flex-col group-data-[rail=full]/rail:w-full group-data-[rail=full]/rail:flex-wrap group-data-[rail=full]/rail:justify-end">
      {children}
    </div>
  );
}

/** Where the body sits. One body, three frames — and one live region in each. */
function Frame({
  placement,
  chatOpen,
  announcement,
  children,
}: {
  placement: Placement;
  chatOpen: boolean;
  announcement: string;
  children: React.ReactNode;
}) {
  // Always mounted, so a change of text is announced; a region inserted
  // together with its text often is not.
  const live = (
    <p role="status" aria-live="polite" className="sr-only">
      {announcement}
    </p>
  );
  if (placement === "phone") {
    return (
      <div
        className="fixed z-40 md:hidden"
        style={{
          // Above the dock: its 72 plus its 24 inset, plus 8 of air, over the home indicator.
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 104px)",
          left: "max(12px, env(safe-area-inset-left, 0px))",
          right: "max(12px, env(safe-area-inset-right, 0px))",
        }}
      >
        <div
          role="region"
          aria-label="Gist room"
          className="ws-glass flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-chrome/90 px-2 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)]"
        >
          {live}
          {children}
        </div>
      </div>
    );
  }
  if (placement === "card") {
    return (
      <div
        role="region"
        aria-label="Gist room"
        className={cn(
          "ws-glass fixed z-40 hidden w-[320px] max-w-[calc(100vw-48px)] items-center gap-2 rounded-2xl border border-white/10 bg-chrome/90 p-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)] md:flex"
        )}
        style={
          chatOpen
            ? // No dock over an open thread, and its composer owns the foot:
              // the top-right of the thread, under the top bar and its header.
              { top: "calc(var(--ws-crumb-h) + 92px)", right: "max(24px, env(safe-area-inset-right, 0px))" }
            : // Clear of the centred dock, which on a narrow desktop reaches this
              // corner, and of a landscape phone's sensor housing.
              { bottom: "calc(var(--ws-nav-h) + 8px)", left: "max(24px, env(safe-area-inset-left, 0px))" }
        }
      >
        {live}
        {children}
      </div>
    );
  }
  return (
    <div
      role="region"
      aria-label="Gist room"
      className="mb-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 group-data-[rail=icon]/rail:border-0 group-data-[rail=icon]/rail:px-0 group-data-[rail=full]/rail:items-stretch group-data-[rail=full]/rail:p-3"
    >
      {live}
      {children}
    </div>
  );
}
