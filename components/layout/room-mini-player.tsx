"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { houseTopic, parseParticipantMeta, participantName } from "@/features/houses";
import { useEndStream, useStageSlots } from "@/features/streams";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconLock, IconRefresh, IconVolume, IconX } from "@/components/ui/icons";
import { IconRoomLeave, IconRoomMic, IconRoomMicOff } from "@/components/ui/room-icons";
import { Sheet } from "@/components/ui/sheet";
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
 * A publisher gets the mic toggle and, while it is open, a pulsing
 * "You're live" — a hot mic somewhere the reader cannot see is the one thing
 * this bar must never let them forget.
 *
 * Every control is a 44px target on touch (the visual circle stays 36), and
 * one always-mounted live region announces the state and the mic.
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
          className={cn(
            "ws-press flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-full px-1 text-left md:min-h-9",
            RAIL_ICON_LINK
          )}
        >
          <span className="ws-live-dot h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
          <span className="min-w-0 flex-1 group-data-[rail=icon]/rail:hidden">
            <span className="block text-[11px] font-semibold uppercase leading-4 tracking-[0.04em] text-grey-400">
              Tap to rejoin
            </span>
            <span className="block truncate text-[13px] font-bold leading-5 text-heading">
              {offer.title || "Your gist room"}
            </span>
          </span>
        </Link>
        <RoundButton
          label="Dismiss"
          onClick={() => {
            keepFocus();
            session.dismissRejoin();
          }}
          className="group-data-[rail=icon]/rail:hidden"
        >
          <IconX className="h-3.5 w-3.5" />
        </RoundButton>
      </Frame>
    );
  }

  if (chip && streamId) return <RoomChip session={session} streamId={streamId} />;
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
        className={cn("ws-press flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full text-left md:min-h-9", RAIL_ICON_LINK)}
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
          {line ? (
            <span
              className={cn(
                "block truncate text-[11px] font-semibold leading-4",
                chrome.retry || state.connection === "reconnecting" ? "text-grey-300" : "text-grey-400"
              )}
            >
              {line}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
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

      {/* "Tap to listen": the browser refused to autoplay, and this tap is the gesture it wants.
          In the icon rail it is a glyph rather than gone. */}
      {chrome.listen && (
        <>
          <Button size="sm" variant="secondary" onClick={session.startAudio} className="shrink-0 max-md:h-11 group-data-[rail=icon]/rail:hidden">
            Listen
          </Button>
          <RoundButton label="Tap to listen" onClick={session.startAudio} className="hidden group-data-[rail=icon]/rail:grid">
            <IconVolume className="h-4 w-4" />
          </RoundButton>
        </>
      )}

      {chrome.retry && (
        <>
          <Button size="sm" variant="secondary" onClick={session.retry} className="shrink-0 max-md:h-11 group-data-[rail=icon]/rail:hidden">
            Retry
          </Button>
          <RoundButton label="Retry the connection" onClick={session.retry} className="hidden group-data-[rail=icon]/rail:grid">
            <IconRefresh className="h-4 w-4" />
          </RoundButton>
        </>
      )}

      {chrome.hotMic && (
        <span
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 text-[11px] font-bold leading-none text-ink group-data-[rail=icon]/rail:hidden"
          aria-hidden
        >
          <span className="ws-live-dot h-1.5 w-1.5 rounded-full bg-ink" />
          You&apos;re live
        </span>
      )}

      {publishing && <MicButton session={session} />}

      {finished ? (
        <DismissButton session={session} />
      ) : (
        <>
          <RoundButton
            label="Return to room"
            onClick={() => router.push(roomHref)}
            className="max-md:hidden group-data-[rail=icon]/rail:hidden"
          >
            <IconChevronUp className="h-4 w-4" />
          </RoundButton>
          <HangUp session={session} streamId={streamId} />
        </>
      )}
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
function RoomChip({ session, streamId }: { session: RoomSessionView; streamId: string }) {
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
      className="ws-glass fixed right-3 z-40 flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-full border border-white/10 bg-chrome/90 py-0.5 pl-1 pr-0.5 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)] md:hidden"
      style={{ top: "calc(var(--ws-topbar-h) + 88px)" }}
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
  const endRoom = useEndStream();
  const { presence } = session;

  const leave = () => {
    keepFocus();
    void session.leave();
  };

  return (
    <>
      <RoundButton
        label={presence === "host" ? "Close the gist room" : "Leave the gist room"}
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

      <Sheet open={confirmClose} onClose={() => setConfirmClose(false)} title="Close the gist room?">
        <p className="text-[13px] leading-5 text-body">Everyone will be sent out and the gist room will be closed.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmClose(false)}>
            Stay
          </Button>
          <Button
            className="flex-1"
            loading={endRoom.isPending}
            onClick={() =>
              endRoom.mutate(streamId, {
                onSuccess: () => {
                  setConfirmClose(false);
                  keepFocus();
                  void session.end();
                },
              })
            }
          >
            Close it
          </Button>
        </div>
      </Sheet>

      <Sheet open={confirmLeaveStage} onClose={() => setConfirmLeaveStage(false)} title="Leave the stage?">
        <p className="text-[13px] leading-5 text-body">You&apos;ll lose your seat. Coming back, you&apos;ll need to ask to speak again.</p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmLeaveStage(false)}>
            Stay
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setConfirmLeaveStage(false);
              leave();
            }}
          >
            Leave
          </Button>
        </div>
      </Sheet>
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
 * tiles already follow); the target shrinks to the circle from `md`, where a
 * pointer is precise.
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
        "ws-press group/round grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9",
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
        className="fixed inset-x-3 z-40 md:hidden"
        // Above the dock: its 72 plus its 24 inset, plus 8 of air, over the home indicator.
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 104px)" }}
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
          "ws-glass fixed z-40 hidden w-[320px] items-center gap-2 rounded-2xl border border-white/10 bg-chrome/90 p-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)] md:flex",
          chatOpen ? "right-6" : "left-6"
        )}
        style={
          chatOpen
            ? // No dock over an open thread, and its composer owns the foot:
              // the top-right of the thread, under the top bar and its header.
              { top: "calc(var(--ws-crumb-h) + 92px)" }
            : // Clear of the centred dock, which on a narrow desktop reaches this corner.
              { bottom: "calc(var(--ws-nav-h) + 8px)" }
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
      className="mb-3 flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 group-data-[rail=full]/rail:flex-row group-data-[rail=full]/rail:p-3"
    >
      {live}
      {children}
    </div>
  );
}
