"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { houseTopic, parseParticipantMeta, participantName } from "@/features/houses";
import { useEndStream, useStageSlots } from "@/features/streams";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconChevronUp, IconLock, IconX } from "@/components/ui/icons";
import { IconRoomLeave, IconRoomMic, IconRoomMicOff } from "@/components/ui/room-icons";
import { Sheet } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { useChatOpen } from "@/lib/chat-open-store";
import { micControl } from "@/lib/mic-consent";
import { setMiniPlayer, useRoomBar } from "@/lib/room-bar-store";
import { useRoomSession, type RoomSessionView } from "@/lib/room-session-store";
import { miniPlayerVisible } from "@/lib/room-session/visibility";
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
 *     offsets: nothing scrolls under it and no button sits on it.
 *   · `card` — a 320px card at the bottom-left on desktop when the rail is off
 *     (guests included), clear of the centred dock.
 *   · `rail` — the rail's foot when the rail is on.
 *
 * States: Connecting, Reconnecting, Room ended (cleared after 5 s by the
 * provider), Playing in another tab, Tap to listen, Switching to your account.
 * A publisher gets the mic toggle and, while it is open, a pulsing
 * "You're live" — a hot mic somewhere the reader cannot see is the one thing
 * this bar must never let them forget.
 *
 * After a reload there is no session (nobody's call resumes without them), so
 * the same placement offers "Tap to rejoin <room>" instead.
 */
type Placement = "phone" | "card" | "rail";

export function RoomMiniPlayer({ placement }: { placement: Placement }) {
  const session = useRoomSession();
  const pathname = stripSquare(usePathname());
  const chatOpen = useChatOpen();
  const roomBar = useRoomBar();
  const phone = useMediaQuery("(max-width: 767px)");
  const onPhone = placement === "phone";
  const streamId = session.state.target?.streamId ?? null;

  const visible =
    onPhone === phone &&
    miniPlayerVisible({
      pathname,
      session: { status: session.state.status, streamId },
      chatOpen,
      isPhone: phone,
      roomBarUp: roomBar,
    });

  const offer = session.rejoinOffer;
  const offering =
    onPhone === phone &&
    !visible &&
    session.state.status === "idle" &&
    offer !== null &&
    pathname !== `/gist-rooms/${offer.streamId}` &&
    !(phone && (chatOpen || roomBar));

  // Only the phone bar moves the layout; the desktop placements float.
  const up = onPhone && (visible || offering);
  useEffect(() => {
    if (!onPhone) return;
    setMiniPlayer(up);
    return () => setMiniPlayer(false);
  }, [onPhone, up]);

  if (offering && offer) {
    return (
      <Frame placement={placement}>
        <Link
          href={sq(`/gist-rooms/${offer.streamId}`)}
          onClick={() => session.dismissRejoin()}
          aria-label={`Tap to rejoin ${offer.title || "your gist room"}`}
          className="ws-press flex min-w-0 flex-1 items-center gap-3 rounded-full px-1 text-left"
        >
          <span className="ws-live-dot h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
          <span className="min-w-0 flex-1 group-data-[rail=icon]/rail:hidden">
            <span className="block text-[11px] font-semibold uppercase leading-4 tracking-[0.04em] text-meta">
              Tap to rejoin
            </span>
            <span className="block truncate text-[13px] font-bold leading-5 text-heading">
              {offer.title || "Your gist room"}
            </span>
          </span>
        </Link>
        <RoundButton label="Dismiss" onClick={session.dismissRejoin} className="group-data-[rail=icon]/rail:hidden">
          <IconX className="h-3.5 w-3.5" />
        </RoundButton>
      </Frame>
    );
  }

  if (!visible || !streamId) return null;
  return <PlayerBody placement={placement} session={session} streamId={streamId} />;
}

function PlayerBody({
  placement,
  session,
  streamId,
}: {
  placement: Placement;
  session: RoomSessionView;
  streamId: string;
}) {
  const router = useRouter();
  const [confirmClose, setConfirmClose] = useState(false);
  const endRoom = useEndStream();
  const { state, stream, presence, room } = session;
  const status = state.status;
  const slots = useStageSlots(room, stream?.ownerId ?? "");

  const title = stream ? houseTopic(stream) : "Gist room";
  const roomHref = sq(`/gist-rooms/${streamId}`);
  const publishing = (presence === "host" || presence === "speaker") && status === "live";
  const finished = status === "ended" || status === "duplicate";

  const line = state.switching
    ? "Switching to your account…"
    : status === "connecting"
      ? "Connecting…"
      : status === "reconnecting"
        ? "Reconnecting…"
        : status === "failed"
          ? "Lost connection"
          : status === "ended"
            ? state.endReason === "removed"
              ? "You were removed"
              : "Room ended"
            : status === "duplicate"
              ? "Playing in another tab"
              : status === "conflict"
                ? "Still playing"
                : !session.canPlayAudio
                  ? "Tap to listen"
                  : null;

  const faces = slots.slice(0, 3);

  return (
    <Frame placement={placement}>
      {/* Back to the room: the whole identity block, so the target is large. */}
      <Link
        href={roomHref}
        aria-label={`Return to ${title}`}
        className="ws-press flex min-w-0 flex-1 items-center gap-2.5 rounded-full text-left"
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            status === "live" ? "ws-live-dot bg-accent" : finished ? "bg-grey-600" : "bg-grey-400"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 group-data-[rail=icon]/rail:hidden">
          <span className="block truncate text-[13px] font-bold leading-5 text-heading">{title}</span>
          {line ? (
            <span
              className={cn(
                "block truncate text-[11px] font-semibold leading-4",
                status === "reconnecting" || status === "failed" ? "text-grey-300" : "text-meta"
              )}
              role="status"
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
              <span className="truncate text-[11px] font-semibold leading-4 text-meta">
                {room ? `${room.numParticipants} in the room` : "Live"}
              </span>
            </span>
          )}
        </span>
      </Link>

      {/* "Tap to listen": the browser refused to autoplay, and this tap is the gesture it wants. */}
      {status === "live" && !session.canPlayAudio && (
        <Button size="sm" variant="secondary" onClick={session.startAudio} className="shrink-0 group-data-[rail=icon]/rail:hidden">
          Listen
        </Button>
      )}

      {status === "failed" && (
        <Button size="sm" variant="secondary" onClick={session.retry} className="shrink-0 group-data-[rail=icon]/rail:hidden">
          Retry
        </Button>
      )}

      {publishing && session.micOn && (
        <span
          className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white px-2.5 text-[11px] font-bold leading-none text-ink group-data-[rail=icon]/rail:hidden"
          role="status"
        >
          <span className="ws-live-dot h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
          You&apos;re live
        </span>
      )}

      {publishing && <MicButton session={session} />}

      {finished ? (
        <RoundButton label="Dismiss" onClick={session.dismiss}>
          <IconX className="h-3.5 w-3.5" />
        </RoundButton>
      ) : (
        <>
          <RoundButton
            label="Return to room"
            onClick={() => router.push(roomHref)}
            className="max-md:hidden group-data-[rail=icon]/rail:hidden"
          >
            <IconChevronUp className="h-4 w-4" />
          </RoundButton>
          <RoundButton
            label={presence === "host" ? "Close the gist room" : "Leave the gist room"}
            onClick={() => (presence === "host" ? setConfirmClose(true) : void session.leave())}
            tone="danger"
          >
            <IconRoomLeave className="h-4 w-4" />
          </RoundButton>
        </>
      )}

      {/* The host's hang-up closes the room for everyone, so it asks — the
          same question the room's own Close asks. */}
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
                  void session.end();
                },
              })
            }
          >
            Close it
          </Button>
        </div>
      </Sheet>
    </Frame>
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
      pressed={!session.micOn}
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

function RoundButton({
  label,
  onClick,
  children,
  disabled = false,
  pressed,
  tone = "default",
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  pressed?: boolean;
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
      aria-pressed={pressed}
      className={cn(
        "ws-press grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "bg-danger/[0.13] text-danger hover:bg-danger/20"
          : tone === "on"
            ? "bg-white text-ink"
            : "bg-white/[0.06] text-heading hover:bg-white/10",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Where the body sits. One body, three frames. */
function Frame({ placement, children }: { placement: Placement; children: React.ReactNode }) {
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
          className="ws-glass flex h-14 items-center gap-2 rounded-2xl border border-white/10 bg-chrome/90 px-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)]"
        >
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
        className="ws-glass fixed left-6 z-40 hidden w-[320px] items-center gap-2 rounded-2xl border border-white/10 bg-chrome/90 p-3 shadow-[0_18px_50px_-16px_rgba(0,0,0,0.95)] md:flex"
        // Clear of the centred dock, which on a narrow desktop reaches this corner.
        style={{ bottom: "calc(var(--ws-nav-h) + 8px)" }}
      >
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
      {children}
    </div>
  );
}
