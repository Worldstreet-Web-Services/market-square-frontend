"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconHand, IconHeart, IconVolume } from "@/components/ui/icons";
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
  onReact: () => void;
  /**
   * A monotonically rising count of hearts SOMEBODY ELSE sent.
   *
   * A number rather than a callback because the room owns the data channel and
   * this owns the gutter: the bar draws the difference since it last looked,
   * so a re-render cannot double-draw and a missed render cannot lose the
   * moment entirely. Reactions are lossy by design either way.
   */
  incoming: number;
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
  incoming,
  leave,
  className,
}: HouseControlsProps) {
  const reactions = useReactionGutter();
  const seen = useRef(incoming);
  useEffect(() => {
    const delta = Math.min(6, incoming - seen.current);
    seen.current = incoming;
    for (let i = 0; i < delta; i += 1) reactions.spawn();
  }, [incoming, reactions]);

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
        {/* Reactions are clipped to a 44x140 gutter above the bar's right edge.
            The app's shared rule drifts a heart -42vh up the whole viewport,
            which over a grid of faces would land on top of the exact avatars
            the brief wants people to tap. Anchoring them to the sender's own
            avatar is better and is deferred — it needs a sender identity on the
            packet. */}
        <div
          className="pointer-events-none absolute bottom-full right-2 h-[140px] w-11 overflow-hidden"
          aria-hidden
        >
          {reactions.hearts.map((heart) => (
            <span
              key={heart.id}
              className="ws-reaction bottom-0 text-accent"
              style={{
                right: `${heart.left}%`,
                ["--rx" as string]: `${heart.drift}px`,
                ["--rr" as string]: `${heart.rotate}deg`,
                ["--rd" as string]: `${heart.duration}s`,
              }}
            >
              <IconHeart className="h-4 w-4" filled />
            </span>
          ))}
        </div>

        <div className="ws-glass flex items-center gap-2 rounded-full px-3 py-2">
          {mic && (
            <button
              onClick={mic.toggle}
              disabled={mic.disabled}
              aria-label={mic.on ? "Mute your microphone" : "Unmute your microphone"}
              aria-pressed={!mic.on}
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

          <button
            onClick={() => {
              reactions.spawn();
              onReact();
            }}
            aria-label="React"
            className={cn(ROUND, "bg-white/8 text-heading")}
          >
            <IconHeart className="h-5 w-5" />
          </button>

          <Button size="sm" variant="ghost" onClick={leave.onLeave}>
            {leave.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface Heart {
  id: number;
  left: number;
  drift: number;
  rotate: number;
  duration: number;
}

let heartSeq = 0;

/** Local drawing only. Broadcast and tally are the caller's job. Shared with
    the phone's bottom bar (room-phone-bar.tsx), which draws the same gutter
    above its reaction disc — one animation, not two that drift. */
export function useReactionGutter() {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    },
    []
  );

  const spawn = useCallback(() => {
    const heart: Heart = {
      id: heartSeq++,
      left: 10 + Math.random() * 40,
      drift: Math.random() * 18 - 9,
      rotate: Math.random() * 40 - 20,
      duration: 1.6 + Math.random() * 0.6,
    };
    // Capped: the gutter is 44px wide, and past a handful the extra hearts are
    // drawing on top of each other rather than being seen.
    setHearts((current) => [...current.slice(-8), heart]);
    const timer = window.setTimeout(() => {
      setHearts((current) => current.filter((item) => item.id !== heart.id));
      timers.current = timers.current.filter((id) => id !== timer);
    }, heart.duration * 1000);
    timers.current.push(timer);
  }, []);

  return { hearts, spawn };
}
