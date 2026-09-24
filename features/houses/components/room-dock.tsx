"use client";

import { IconHand } from "@/components/ui/icons";
import { IconRoomMic, IconRoomMicOff } from "@/components/ui/room-icons";
import { ReactionControl } from "@/features/houses/components/reaction-control";
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
 *  - **The emoji circle** (129:12498) opens the reaction picker (node
 *    1775:20163). A pick floats up over the stage the way a call reaction does
 *    (RoomReactions) and rides the room's reaction channel, so everyone sees
 *    the same glyph — the heart is just its default.
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
  onGift,
  onPeople,
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
  onReact: (emoji: string) => void;
  /**
   * OPEN THE GIFT TRAY. Absent on a surface that draws no gifts, so the dock
   * simply has one fewer button rather than a button that opens nothing.
   *
   * It sits beside the reactions rather than inside them because the two are
   * different acts: a reaction is a feeling and costs nothing to send, a gift
   * is an OBJECT chosen from a tray and is the thing a host thanks you for.
   * Folding gifts into the emoji picker would have made the larger act the
   * harder one to find.
   */
  onGift?: () => void;
  /**
   * THE HOST'S PEOPLE BUTTON — node 1285:29830 puts it third in the dock,
   * between the microphone and the reactions, and it is where a host appoints
   * a moderator (ogazboiz: "that is where the host will give someone in the
   * space a moderator").
   *
   * Null for everybody else, and for a host on a service that does not carry
   * moderators yet — so the dock simply has one fewer button rather than a
   * button that cannot work.
   */
  onPeople: (() => void) | null;
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
            data-room-mic=""
            aria-label={mic.on ? "Mute your microphone" : "Unmute your microphone"}
            className={cn(
              "ws-press flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:opacity-40",
              mic.on ? "ws-glass-pill text-white" : "bg-white text-black"
            )}
          >
            {mic.on ? <IconRoomMic className="h-6 w-6" /> : <IconRoomMicOff className="h-6 w-6" />}
          </button>
        )}

        {/* `vuesax/outline/people`, 20 inside the dock's own 40 target. It sits
            between the microphone and the reactions exactly as the file draws
            it — the order is the file's, not a preference. */}
        {onPeople && (
          <button
            type="button"
            onClick={onPeople}
            aria-label="Manage moderators"
            title="Add or remove a moderator"
            className="ws-glass-pill ws-press flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity"
          >
            <IconDockPeople />
          </button>
        )}

        {onGift && (
          <button
            type="button"
            onClick={onGift}
            aria-label="Send a gift"
            title="Send a gift"
            className="ws-glass-pill ws-press flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity"
          >
            <IconDockGift />
          </button>
        )}

        <ReactionControl
          onReact={onReact}
          triggerClassName="ws-glass-pill ws-press flex h-10 w-10 items-center justify-center rounded-full text-white"
        />
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
/**
 * `vuesax/outline/people` — node 1948:18355's own 20px glyph, EXPORTED from
 * the file rather than redrawn. An approximation of an icon is a different
 * icon: this one is six paths of two-figures-and-a-third, and the hand-drawn
 * stand-in it replaces had two figures and a shoulder.
 *
 * `currentColor` in place of the export's `white`, so the dock's own text
 * colour drives it and no hex enters features/houses.
 */
function IconDockPeople() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none">
      <path d="M14.999 6.59246C14.974 6.59246 14.9573 6.59246 14.9323 6.59246H14.8906C13.3156 6.54246 12.1406 5.32578 12.1406 3.82578C12.1406 2.29245 13.3906 1.05078 14.9156 1.05078C16.4406 1.05078 17.6906 2.30078 17.6906 3.82578C17.6823 5.33412 16.5073 6.55078 15.0073 6.60078C15.0073 6.59245 15.0073 6.59246 14.999 6.59246ZM14.9156 2.29245C14.074 2.29245 13.3906 2.97579 13.3906 3.81745C13.3906 4.64245 14.0323 5.30912 14.8573 5.34246C14.8656 5.33412 14.9323 5.33412 15.0073 5.34246C15.8156 5.30079 16.4406 4.63412 16.449 3.81745C16.449 2.97579 15.7656 2.29245 14.9156 2.29245Z" fill="currentColor" />
      <path d="M15.0078 12.7339C14.6828 12.7339 14.3578 12.7089 14.0328 12.6505C13.6911 12.5922 13.4661 12.2672 13.5244 11.9255C13.5828 11.5839 13.9078 11.3589 14.2494 11.4172C15.2744 11.5922 16.3578 11.4005 17.0828 10.9172C17.4744 10.6589 17.6828 10.3339 17.6828 10.0089C17.6828 9.68386 17.4661 9.36719 17.0828 9.10886C16.3578 8.62553 15.2578 8.43386 14.2244 8.6172C13.8828 8.68386 13.5578 8.45053 13.4994 8.10886C13.4411 7.7672 13.6661 7.4422 14.0078 7.38387C15.3661 7.1422 16.7744 7.40053 17.7744 8.06719C18.5078 8.55886 18.9328 9.25886 18.9328 10.0089C18.9328 10.7505 18.5161 11.4589 17.7744 11.9589C17.0161 12.4589 16.0328 12.7339 15.0078 12.7339Z" fill="currentColor" />
      <path d="M4.97539 6.59102C4.96706 6.59102 4.95872 6.59102 4.95872 6.59102C3.45872 6.54102 2.28372 5.32435 2.27539 3.82435C2.27539 2.29101 3.52539 1.04102 5.05039 1.04102C6.57539 1.04102 7.82539 2.29102 7.82539 3.81602C7.82539 5.32435 6.65039 6.54102 5.15039 6.59102L4.97539 5.96602L5.03373 6.59102C5.01706 6.59102 4.99206 6.59102 4.97539 6.59102ZM5.05872 5.34102C5.10872 5.34102 5.15039 5.34101 5.20039 5.34935C5.94206 5.31601 6.59206 4.64935 6.59206 3.82435C6.59206 2.98268 5.90873 2.29934 5.06706 2.29934C4.22539 2.29934 3.54206 2.98268 3.54206 3.82435C3.54206 4.64101 4.17539 5.29935 4.98372 5.34935C4.99206 5.34101 5.02539 5.34102 5.05872 5.34102Z" fill="currentColor" />
      <path d="M4.96602 12.7339C3.94102 12.7339 2.95768 12.4589 2.19935 11.9589C1.46602 11.4672 1.04102 10.7589 1.04102 10.0089C1.04102 9.26719 1.46602 8.55886 2.19935 8.06719C3.19935 7.40053 4.60768 7.1422 5.96602 7.38387C6.30768 7.4422 6.53268 7.7672 6.47435 8.10886C6.41602 8.45053 6.09102 8.68386 5.74935 8.6172C4.71602 8.43386 3.62435 8.62553 2.89102 9.10886C2.49935 9.36719 2.29102 9.68386 2.29102 10.0089C2.29102 10.3339 2.50768 10.6589 2.89102 10.9172C3.61602 11.4005 4.69935 11.5922 5.72435 11.4172C6.06601 11.3589 6.39102 11.5922 6.44935 11.9255C6.50768 12.2672 6.28268 12.5922 5.94102 12.6505C5.61602 12.7089 5.29102 12.7339 4.96602 12.7339Z" fill="currentColor" />
      <path d="M9.99896 12.8171C9.97396 12.8171 9.95729 12.8171 9.93229 12.8171H9.89062C8.31562 12.7671 7.14062 11.5504 7.14062 10.0504C7.14062 8.51706 8.39063 7.27539 9.91563 7.27539C11.4406 7.27539 12.6906 8.52539 12.6906 10.0504C12.6823 11.5587 11.5073 12.7754 10.0073 12.8254C10.0073 12.8171 10.0073 12.8171 9.99896 12.8171ZM9.91563 8.51706C9.07396 8.51706 8.39062 9.2004 8.39062 10.0421C8.39062 10.8671 9.03229 11.5337 9.85729 11.5671C9.86563 11.5587 9.93229 11.5587 10.0073 11.5671C10.8156 11.5254 11.4406 10.8587 11.449 10.0421C11.449 9.20873 10.7656 8.51706 9.91563 8.51706Z" fill="currentColor" />
      <path d="M9.99974 18.9676C8.99974 18.9676 7.99974 18.7093 7.22474 18.1843C6.49141 17.6926 6.06641 16.9926 6.06641 16.2426C6.06641 15.5009 6.48307 14.7842 7.22474 14.2926C8.78307 13.2592 11.2247 13.2592 12.7747 14.2926C13.5081 14.7842 13.9331 15.4842 13.9331 16.2342C13.9331 16.9759 13.5164 17.6926 12.7747 18.1843C11.9997 18.7009 10.9997 18.9676 9.99974 18.9676ZM7.91641 15.3426C7.52474 15.6009 7.31641 15.9259 7.31641 16.2509C7.31641 16.5759 7.53307 16.8926 7.91641 17.1509C9.04141 17.9093 10.9497 17.9093 12.0747 17.1509C12.4664 16.8926 12.6747 16.5676 12.6747 16.2426C12.6747 15.9176 12.4581 15.6009 12.0747 15.3426C10.9581 14.5843 9.04974 14.5926 7.91641 15.3426Z" fill="currentColor" />
    </svg>
  );
}


/**
 * The dock's gift mark — a wrapped box at 20 inside the dock's own 40 target,
 * matching the weight of `IconDockPeople` beside it rather than a heavier
 * glyph that would pull the eye out of the row.
 */
function IconDockGift() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none">
      <path d="M3 9.5h14v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 6.5h15v3h-15z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 6.5v11.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 6.5S8.8 2.5 6.75 2.5a1.9 1.9 0 0 0 0 4H10Zm0 0s1.2-4 3.25-4a1.9 1.9 0 0 1 0 4H10Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
