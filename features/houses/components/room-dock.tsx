"use client";

import { IconHand } from "@/components/ui/icons";
import {
  IconEmojiAdd,
  IconRecord,
  IconRoomMic,
  IconRoomMicOff,
} from "@/components/ui/room-icons";
import { cn } from "@/lib/cn";

/**
 * THE ROOM'S BOTTOM BAR — node 129:12197 (host) and 121:10995 (audience).
 *
 * It belongs to the LEFT COLUMN, not to the viewport: 80 tall, `#101012`, a
 * 1px `white/10` hairline along its top edge, 16px/24px of padding, one
 * labelled pill held at the left edge and the round controls at the right on a
 * 16px gap.
 *
 * THE TWO FRAMES ARE THE SAME BAR WITH A DIFFERENT LEFT PILL:
 *
 *  - **Host** (129:12198) — `Record Gist`, the purple-gradient pill whose two
 *    stops ARE `--color-create` and `--color-create-deep` exactly, at 90°.
 *    (Not `ws-btn-create`, which is the same ramp at 155° — the angle is the
 *    file's.) It is DISABLED: nothing in the service records a room. Recording
 *    needs LiveKit egress and a bucket to write to, neither of which is
 *    provisioned — the same reason `MARKET_FLAGS.replays` is off. Per the
 *    flagged-capability rule it is visible and genuinely `disabled` with the
 *    reason on it, never a live-looking button that records nothing.
 *  - **Audience** (121:10996) — `Give a tip`, the same pill with the donate
 *    glyph, supplied as a SLOT because tipping is the tips slice's and slices
 *    never import each other. It renders nothing on your own room or where the
 *    service refuses the recipient, which is that component's own rule.
 *
 * THE ROUND CONTROLS, right to left:
 *
 *  - **The emoji circle** (129:12498) sends a heart into the room's reaction
 *    channel. The file's glyph is `emoji-add`, and a reaction is the one thing
 *    it can honestly mean here: the room has no emoji picker, and the data
 *    channel this fires is the same one the hearts already ride.
 *  - **The microphone** (129:12493) mutes and unmutes the viewer's own
 *    microphone, and is present only for somebody who has one — the host or a
 *    seated guest. The audience frame draws it SLASHED, which is exactly what
 *    somebody with no seat has; here it is simply absent for them, because a
 *    permanently-crossed mic is a control that cannot be pressed.
 *  - **The raised hand** is NOT in either frame, and is here deliberately. The
 *    file routes an audience member to a seat through the header's "Join
 *    House" pill, which is one pill at the top of a page that scrolls — so on
 *    a long room the only way to ask for the floor is off screen. The hand
 *    sits beside the mic it is asking for, carries the elapsed wait once it is
 *    up ("Hand up · 4m"), and lowers on a second press. Everything about it
 *    reuses the room's existing request state; nothing new is invented.
 */
export function RoomDock({
  primary,
  mic,
  ask,
  onReact,
  className,
}: {
  /** The file's left-hand pill: `Record Gist` for a host, `Give a tip` for everyone else. */
  primary: React.ReactNode;
  /** Present only when this viewer is publishing — host or seated guest. */
  mic: { on: boolean; toggle: () => void; disabled: boolean } | null;
  /** Present only for somebody in the audience who may ask for the floor. */
  ask: {
    label: string;
    /** Set when the control is unavailable — shown as its title, never a toast. */
    reason: string | null;
    pending: boolean;
    busy: boolean;
    onAsk: () => void;
    onLower: () => void;
  } | null;
  onReact: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // The file paints the bar `#101012`; `--color-raised` is `#0f0f11`,
        // one value per channel away, and a fifth near-black token for a
        // difference nobody can see is how a palette stops being a palette.
        //
        // 369:9467 stacks a SECOND fill on it — white at 3% — which composites
        // to about (23,23,25) against this (15,15,17). Eight levels, on a bar
        // that already separates itself from the page with a hairline, and the
        // slice may hold no raw colour to express it. Left as the token, and
        // stated so the next person does not read it as an oversight.
        "flex h-20 shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-raised px-6",
        className
      )}
    >
      <div className="flex min-w-0 shrink items-center gap-3">{primary}</div>

      <div className="flex shrink-0 items-center gap-4">
        {ask &&
          (ask.pending ? (
            // Up already: the pill says how long, and pressing it puts the hand
            // back down. A raised hand with no way to lower it is a request you
            // cannot withdraw.
            <button
              type="button"
              onClick={ask.onLower}
              disabled={ask.busy}
              aria-pressed
              aria-label={`${ask.label}. Lower your hand.`}
              className="ws-press flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-3 text-[12px] font-medium leading-4 text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <IconHand className="h-4 w-4" />
              <span className="tnum">{ask.label}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={ask.onAsk}
              disabled={ask.busy || ask.reason !== null}
              title={ask.reason ?? "Ask to speak"}
              aria-label={ask.reason ?? "Ask to speak"}
              className="ws-glass-pill ws-press flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
            >
              <IconHand className="h-5 w-5" />
            </button>
          ))}

        {mic && (
          <button
            type="button"
            onClick={mic.toggle}
            disabled={mic.disabled}
            aria-label={mic.on ? "Mute your microphone" : "Unmute your microphone"}
            className={cn(
              "ws-press flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-40",
              mic.on ? "ws-glass-pill text-white" : "bg-white text-black"
            )}
          >
            {mic.on ? <IconRoomMic className="h-6 w-6" /> : <IconRoomMicOff className="h-6 w-6" />}
          </button>
        )}

        <button
          type="button"
          onClick={onReact}
          aria-label="Send a heart"
          className="ws-glass-pill ws-press flex h-10 w-10 items-center justify-center rounded-full text-white"
        >
          <IconEmojiAdd className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * `Record Gist` — node 129:12198, the host's pill.
 *
 * Exported so the room can hand it to `primary` beside the tip slot without
 * either of them knowing about the other.
 */
export function RecordGistButton() {
  return (
    <button
      type="button"
      disabled
      title="Recording a gist room needs egress, which is not provisioned yet."
      className="ws-press flex h-10 shrink-0 items-center gap-2 rounded-full bg-[linear-gradient(90deg,var(--color-create)_0%,var(--color-create-deep)_100%)] px-3 text-[12px] font-medium leading-4 text-white shadow-[0_1px_2px_-1px_rgba(0,0,0,0.1),0_1px_3px_0_rgba(0,0,0,0.1)] disabled:opacity-40"
    >
      <IconRecord className="h-4 w-4" />
      Record Gist
    </button>
  );
}
