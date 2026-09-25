"use client";

import { useEffect } from "react";
import {
  IconRoomChat,
  IconRoomGift,
  IconRoomHandUp,
  IconRoomMic,
  IconRoomMicOff,
  IconRoomPeople,
} from "@/components/ui/room-icons";
import { cn } from "@/lib/cn";
import { setRoomBar } from "@/lib/room-bar-store";
import { ReactionControl } from "@/features/houses/components/reaction-control";
import { roomChatBadge, roomChatLabel } from "@/lib/room-chat-unread";

/**
 * THE PHONE'S BOTTOM BAR — node 1285:93076 (`Chat Top Nav Alt`) in the phone
 * frame 1285:92794, and the reason the shell's dock is absent below `md`
 * while a room is live: it rings `lib/room-bar-store.ts` on mount and the
 * dock steps aside for exactly as long as this stands in its place.
 *
 * THE FILE'S NUMBERS: 390×80 pinned to the frame's bottom edge; two fills
 * stacked — `#FFFFFF` at 3% OVER `#101012` — under a 1px `white/10` hairline
 * along the top; 16/24 of padding; the controls held at the right edge as four
 * 40px discs on an 8px gap. Every disc is the file's GLASS material: a fully
 * transparent fill and a white stroke at weight ZERO, which renders nothing —
 * so no border is drawn, and the lens is `ws-glass-pill`, the measured render
 * of exactly that effect (see globals.css).
 *
 * `bg-raised` is `#0f0f11`, one value per channel away from the file's
 * `#101012` — the same call `RoomDock` makes, for the same reason: the slice
 * holds no raw colour. The 3% white plate is stacked over it as a gradient
 * image, so the composite is the file's rather than the bare token.
 *
 * THE LEFT PILL IS NOT `Record Gist`. The file draws that there and it is left
 * out on instruction: nothing in the service records a room (egress is not
 * provisioned — `MARKET_FLAGS.replays` is off for the same reason). The slot
 * itself stays, and carries what the desktop dock puts in the same place —
 * `Give a tip` for the audience, nothing for a host, who cannot tip their own
 * room. A control that exists on a desktop and not on a phone is not a smaller
 * layout, it is a missing feature.
 *
 * THE DISCS, left to right, each a REAL control on the room's existing state:
 *
 *  - **People** (`vuesax/outline/people`, 20) — the HOST's moderator sheet,
 *    the same one the desktop dock opens, sitting between the microphone and
 *    the reactions exactly as the dock places it. Absent for everybody else and
 *    on a service that carries no moderators.
 *  - **Gift** (a wrapped box at 20) — opens the gift tray with nobody chosen,
 *    so a gift can be started from the bar rather than only by tapping a person
 *    on the stage. Tapping a person still works and still pre-selects them;
 *    this is the door for "I want to send something" rather than "I want to
 *    send something TO HER", and on a phone it was the only one missing.
 *  - **Microphone** (`streamline:voice-mail`, 20) — the viewer's own mute,
 *    the same `toggleMic` the desktop bar and the `M` key fire. Somebody with
 *    no seat has no microphone to toggle, and the file draws exactly that:
 *    the audience frame's mic is SLASHED. So for them it is the slashed glyph,
 *    genuinely `disabled`, with the reason on it — never a live-looking disc
 *    that does nothing. The way to a microphone is the raised hand beside it.
 *  - **Reaction** (`fluent:emoji-add-16-regular`, 20) — opens the reaction
 *    picker (node 1775:20163); a pick floats over the stage the way a call
 *    reaction does (RoomReactions) and rides the room's reaction channel.
 *  - **Chat** (`vuesax/outline/messages-2`, 20) — opens the room's chat as a
 *    sheet. The desktop's third column does not exist on a phone; the chat is
 *    still the only way somebody without a seat can say anything, so it is
 *    one tap away rather than a page-length scroll away.
 *  - **Raised hand** (`fluent-emoji-high-contrast:victory-hand`, 16) — for
 *    the HOST, the speaker-request queue with the count of hands up in the
 *    file's 10px purple badge (`2` in the frame); for everybody else, the
 *    request-to-speak itself — the same mutation the empty chair and the
 *    desktop bar fire — pressed while the hand is up, and a second press
 *    lowers it.
 */
export function RoomPhoneBar({
  primary,
  mic,
  ask,
  tray,
  onReact,
  onGift,
  onPeople,
  onChat,
  unreadChat = 0,
}: {
  /**
   * The left-hand slot — `Give a tip` for the audience, nothing for a host.
   *
   * THE SAME NODE THE DESKTOP DOCK TAKES, and a slot here for the same reason:
   * tipping belongs to the tips slice and slices do not import each other. It
   * removes itself where a tip could not be taken, so an untippable room simply
   * has an empty left edge rather than a button that is refused.
   */
  primary?: React.ReactNode;
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
  /** The host's counted request tray. */
  tray: { count: number; onOpen: () => void } | null;
  /** Fires the picked glyph — drawn over the stage and broadcast by the room. */
  onReact: (emoji: string) => void;
  /** Opens the gift tray with nobody chosen. Absent where a surface draws no gifts. */
  onGift?: () => void;
  /** The host's moderator sheet. Null for everybody else — see the dock's own note. */
  onPeople?: (() => void) | null;
  onChat: () => void;
  /** Messages that have arrived since the reader last had the chat open. */
  unreadChat?: number;
}) {
  // The doorbell: the shell's dock is gone while this is mounted, and back
  // the moment it is not — a closed or unopened room keeps its dock.
  useEffect(() => {
    setRoomBar(true);
    return () => setRoomBar(false);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      <div
        className={cn(
          /*
            THE GUTTER AND THE GAP ARE TIGHTER BELOW `sm` THAN THE FILE'S, and
            that is a measurement rather than a preference.

            The file draws this bar at 390 with FOUR discs. It now carries up to
            six, or five and the tip pill, because a phone has to reach every
            control the desktop dock has. At the file's 24px gutter and 8px gap
            the audience row — the 98-wide pill, five 40px discs and the gaps
            between all six — comes to 386 of content, which runs off a 375
            iPhone SE and a 360 Android: the right-most disc does not wrap or
            shrink, it simply leaves the screen.

            16 and 6 bring that to exactly 360, this codebase's narrowest
            declared phone (`composer.tsx`, `app-shell.tsx`). The file's own
            numbers are kept from `sm` up, where they fit.
          */
          "flex h-16 items-center justify-between gap-1.5 border-t border-white/10 px-4 sm:gap-2 sm:px-6",
          // The file's two fills, in order: 3% white OVER the bar's own near-black.
          "bg-raised bg-[linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]",
          // The home indicator sits under the bar, not over its discs.
          "pb-[env(safe-area-inset-bottom,0px)]"
        )}
      >
        {/*
          THE LEFT SLOT — `Give a tip`, in the position the file gives the
          left-hand pill and the desktop dock gives `primary`.

          `min-w-0` so that if a future control makes this row too wide, the
          LABEL is what gives way. Losing a whole disc off the right edge is the
          worse failure: a clipped word is still a control you can press, and an
          off-screen one is a feature that does not exist on a phone.
        */}
        <div className="flex min-w-0 shrink items-center">{primary}</div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {mic ? (
            <button
              type="button"
              onClick={mic.toggle}
              disabled={mic.disabled}
              data-room-mic=""
              aria-label={mic.on ? "Mute your microphone" : "Unmute your microphone"}
              className={cn(
                DISC,
                // Muted is the silver inversion the desktop bar uses — two
                // channels (fill and glyph), no borrowed semantic token.
                mic.on ? "ws-glass-pill text-white" : "bg-white text-black"
              )}
            >
              {mic.on ? <IconRoomMic className="h-5 w-5" /> : <IconRoomMicOff className="h-5 w-5" />}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="You need a seat to speak. Raise your hand to ask for one."
              aria-label="Microphone off — you need a seat to speak. Raise your hand to ask for one."
              className={cn(DISC, "ws-glass-pill text-white")}
            >
              <IconRoomMicOff className="h-5 w-5" />
            </button>
          )}

          {/* BETWEEN THE MICROPHONE AND THE REACTIONS, which is where node
              1285:29830 puts the people button on the desktop dock. The order is
              the file's; a phone that reshuffles the same controls costs the
              person the one thing a second screen should give them for free. */}
          {onPeople && (
            <button
              type="button"
              onClick={onPeople}
              aria-label="Manage moderators"
              title="Add or remove a moderator"
              className={cn(DISC, "ws-glass-pill text-white")}
            >
              <IconRoomPeople />
            </button>
          )}

          {onGift && (
            <button
              type="button"
              onClick={onGift}
              aria-label="Send a gift"
              title="Send a gift"
              className={cn(DISC, "ws-glass-pill text-white")}
            >
              <IconRoomGift />
            </button>
          )}

          {/* The reaction disc opens the picker; a pick floats over the stage
              (RoomReactions) and broadcasts, rather than drawing in a local
              gutter here. */}
          <ReactionControl onReact={onReact} triggerClassName={cn(DISC, "ws-glass-pill text-white")} />

          <button
            type="button"
            onClick={onChat}
            aria-label={roomChatLabel(unreadChat)}
            aria-haspopup="dialog"
            className={cn(DISC, "ws-glass-pill relative text-white")}
          >
            <IconRoomChat className="h-5 w-5" />
            {/* The count the room's chat sheet hides while it is closed. Same
                badge the bell draws: 14px with 9px semibold type is the smallest
                that stays readable on a phone, and past nine it reads "9+". */}
            {roomChatBadge(unreadChat) && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-spotlight px-[3px] text-[9px] font-semibold leading-none text-white ring-2 ring-chrome"
              >
                {roomChatBadge(unreadChat)}
              </span>
            )}
          </button>

          {tray && (
            <button
              type="button"
              onClick={tray.onOpen}
              aria-haspopup="dialog"
              aria-label={
                tray.count > 0 ? `Requests to speak, ${tray.count} waiting` : "Requests to speak"
              }
              className={cn(DISC, "ws-glass-pill relative text-white")}
            >
              <IconRoomHandUp className="h-4 w-4" />
              {tray.count > 0 && <HandBadge count={tray.count} />}
            </button>
          )}

          {ask &&
            (ask.pending ? (
              <button
                type="button"
                onClick={ask.onLower}
                disabled={ask.busy}
                aria-pressed
                aria-label={`${ask.label}. Lower your hand.`}
                className={cn(DISC, "bg-white text-black")}
              >
                <IconRoomHandUp className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={ask.onAsk}
                disabled={ask.busy || ask.reason !== null}
                title={ask.reason ?? "Ask to speak"}
                aria-label={ask.reason ?? "Ask to speak"}
                className={cn(DISC, "ws-glass-pill text-white")}
              >
                <IconRoomHandUp className="h-4 w-4" />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

const DISC =
  "ws-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40";

/**
 * Node 1285:93100 — a 10px disc in `--color-spotlight` (the file's `#7E3BEB`
 * exactly) at (21, 22) inside the 40px disc, the count at Medium 8/9.375 in
 * white. The dark stop as a FILL with white ink, per the design language.
 */
function HandBadge({ count }: { count: number }) {
  return (
    <span className="tnum absolute left-[21px] top-[22px] flex h-[10px] min-w-[10px] items-center justify-center rounded-full bg-spotlight px-[2px] text-[8px] font-medium leading-[9.375px] text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
