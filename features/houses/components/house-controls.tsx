"use client";

import { Button } from "@/components/ui/button";
import { IconHand, IconVolume } from "@/components/ui/icons";
import { ReactionControl } from "@/features/houses/components/reaction-control";
import { cn } from "@/lib/cn";

/**
 * The control bar: the only floating chrome in the room.
 *
 * `ws-glass` lives here and nowhere else in the feature. The ring, the bands
 * and the rows are CONTENT — they get --color-panel/--color-ground and
 * hairlines, so the square reads as one continuous surface. Glass is for
 * things that float over content on purpose, which is this and only this.
 *
 * The muted mic is a SILVER INVERSION plus a glyph, not a red fill. The stream
 * room paints a muted mic `bg-down/80`, and --color-down means "this value
 * went down"; borrowing it here would put a fifth meaning on a token that has
 * one. Inversion plus glyph is two channels and no borrowed semantics.
 */
const ROUND =
  "ws-press flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export interface HouseControlsProps {
  /** Present when this viewer is publishing — host or seated guest. */
  mic: { on: boolean; toggle: () => void; disabled: boolean } | null;
  /** Present when this viewer is in the audience and may ask. */
  ask: {
    label: string;
    /** Set when the button is disabled: shown inline, above the bar, never in a toast. */
    reason: string | null;
    pending: boolean;
    onAsk: () => void;
    onLower: () => void;
    busy: boolean;
  } | null;
  /** The host's counted request tray. */
  tray: { count: number; onOpen: () => void } | null;
  /** Fires the picked glyph — drawn over the stage and broadcast by the room. */
  onReact: (emoji: string) => void;
  leave: { label: string; onLeave: () => void };
  /**
   * Merged into the root. The room hides this whole pill from `xl` up, where
   * the file gives every one of its controls a place in the page's own chrome.
   */
  className?: string;
}

export function HouseControls({
  mic,
  ask,
  tray,
  onReact,
  leave,
  className,
}: HouseControlsProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[var(--ws-nav-h)] z-40 mx-auto w-[calc(100%-2rem)] max-w-[520px]",
        className
      )}
    >
      {/* The reason a control is unavailable belongs beside the control, not in
          a toast that has already gone by the time somebody taps it again. */}
      {ask?.reason && (
        <p className="ws-meta mb-1.5 px-2 text-center normal-case tracking-normal">{ask.reason}</p>
      )}

      <div className="relative">
        {/* Reactions no longer draw in a small gutter here: a picked glyph now
            floats over the stage (RoomReactions), the call-reaction pattern,
            and the same layer draws the ones other people send. */}
        <div className="ws-glass flex items-center gap-2 rounded-full px-3 py-2">
          {mic && (
            <button
              onClick={mic.toggle}
              disabled={mic.disabled}
              aria-label={mic.on ? "Mute your microphone" : "Unmute your microphone"}
              className={cn(
                ROUND,
                mic.on ? "bg-white/8 text-heading" : "bg-accent text-ink",
                mic.disabled && "opacity-50"
              )}
            >
              <IconVolume className="h-5 w-5" muted={!mic.on} />
            </button>
          )}

          {ask &&
            (ask.pending ? (
              <>
                <span className="flex h-11 items-center gap-2 rounded-full bg-white/8 px-3 text-[12px] font-semibold text-body">
                  <IconHand className="h-4 w-4 text-create" />
                  <span className="tnum">{ask.label}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={ask.onLower} disabled={ask.busy}>
                  Lower hand
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={ask.onAsk}
                disabled={ask.reason !== null || ask.busy}
              >
                {/* The same mutation the empty chair fires. Tapping a dashed
                    circle is a discoverable delight, not a discoverable
                    affordance — Clubhouse's Pinned Link died of exactly that —
                    so the labelled button carries it too. */}
                {ask.label}
              </Button>
            ))}

          {tray && (
            <button
              onClick={tray.onOpen}
              aria-label={
                tray.count > 0 ? `Requests to speak, ${tray.count} waiting` : "Requests to speak"
              }
              className={cn(ROUND, "relative bg-white/8 text-heading")}
            >
              <IconHand className="h-5 w-5" />
              {tray.count > 0 && (
                <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-spotlight px-1 text-[10px] font-bold leading-4 text-white">
                  {tray.count}
                </span>
              )}
            </button>
          )}

          <div className="flex-1" />

          <ReactionControl
            onReact={onReact}
            triggerClassName={cn(ROUND, "bg-white/8 text-heading")}
          />

          <Button size="sm" variant="ghost" onClick={leave.onLeave}>
            {leave.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
