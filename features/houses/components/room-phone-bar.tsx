"use client";

import { useEffect } from "react";
import {
  IconRoomChat,
  IconRoomHandUp,
  IconRoomMic,
  IconRoomMicOff,
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
 * THE LEFT PILL IS NOT HERE. The file draws `Record Gist` there and it is
 * left out on instruction: nothing in the service records a room (egress is
 * not provisioned — `MARKET_FLAGS.replays` is off for the same reason).
 *
 * THE DISCS, left to right, each a REAL control on the room's existing state:
 *
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
  mic,
  ask,
  tray,
  onReact,
  onChat,
  unreadChat = 0,
}: {
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
          "flex h-16 items-center justify-end gap-2 border-t border-white/10 px-6",
          // The file's two fills, in order: 3% white OVER the bar's own near-black.
          "bg-raised bg-[linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]",
          // The home indicator sits under the bar, not over its discs.
          "pb-[env(safe-area-inset-bottom,0px)]"
        )}
      >
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
