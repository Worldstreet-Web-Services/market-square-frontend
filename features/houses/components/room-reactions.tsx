"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FLOATING REACTIONS OVER THE STAGE — the call-reaction pattern.
 *
 * A picked emoji rises up over the room and fades, the way a reaction does in
 * Google Meet or a WhatsApp call, and the SAME layer draws the ones other
 * people send (fed from the room's data channel). One controller, so a local
 * tap and an incoming packet look identical and cannot double-draw.
 *
 * Drawing only. Broadcasting a local tap and validating an incoming glyph are
 * the caller's job (`useLiveReactions`); this just floats what it is handed.
 * It reuses `ws-reaction`, so it inherits the shared float and the reduced-
 * motion shortening already defined in globals.css.
 */
export interface FloatingReaction {
  id: number;
  emoji: string;
  /** Who sent it — "You" on your own screen, their name on everyone else's. */
  label: string;
  /** Horizontal start, a percentage of the stage width. */
  left: number;
  /** Sideways drift over the rise, in px. */
  drift: number;
  /** Tilt over the rise, in degrees. */
  rotate: number;
  /** How long the rise lasts, in seconds. */
  duration: number;
}

let seq = 0;

/** Past a handful on screen the extra glyphs draw on top of each other. */
const MAX_ON_SCREEN = 24;
/** One tap can burst, but not spray the whole stage. */
const MAX_BURST = 8;

/**
 * HOW LONG ONE EMOJI TAKES TO DRIFT UP, in seconds.
 *
 * The travel is fixed in CSS (-42vh), so this IS the speed: a longer duration
 * over the same distance is a slower drift, not a longer one. Raised from
 * 2.2–3.0s, which read as a flick — the emoji was gone before anybody could
 * see whose it was or what it said (ogazboiz, 2026-09-23: "can we reduce the
 * speed a little bit for the reaction time").
 *
 * Kept as a RANGE rather than one number: identical durations make a burst
 * move like a single object, and the spread is what makes it read as several
 * people reacting rather than one animation playing.
 *
 * `MAX_ON_SCREEN` (24) is what keeps the slower drift from becoming clutter —
 * each one lives longer, so more overlap, and the cap is the thing that bounds
 * it. Raising these much further means lowering that.
 *
 * Reduced motion ignores both: `.ws-reaction` is pinned to 0.8s in globals.css,
 * and a slower drift is the opposite of what that setting asks for.
 */
const FLOAT_SECONDS_MIN = 3.2;
const FLOAT_SECONDS_SPREAD = 1;

export function useRoomReactions() {
  const [items, setItems] = useState<FloatingReaction[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current = [];
    },
    []
  );

  const emit = useCallback((emoji: string, burst = 1, label = "") => {
    const count = Math.min(Math.max(Math.floor(burst), 1), MAX_BURST);
    for (let i = 0; i < count; i += 1) {
      const item: FloatingReaction = {
        id: seq++,
        emoji,
        label,
        left: 8 + Math.random() * 74,
        drift: Math.random() * 44 - 22,
        rotate: Math.random() * 40 - 20,
        duration: FLOAT_SECONDS_MIN + Math.random() * FLOAT_SECONDS_SPREAD,
      };
      setItems((current) => [...current.slice(-(MAX_ON_SCREEN - 1)), item]);
      const timer = window.setTimeout(() => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        timers.current = timers.current.filter((id) => id !== timer);
      }, item.duration * 1000);
      timers.current.push(timer);
    }
  }, []);

  return { items, emit };
}

/**
 * The overlay itself — VIEWPORT-fixed so a scrolling room never drags a rising
 * glyph off with it, and clipped to the stage on desktop (the chat column is
 * 411 wide on `xl`, so the glyphs never float over the messages). It ignores
 * pointer events so it never sits between the viewer and a control.
 */
export function RoomReactions({ items }: { items: FloatingReaction[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden xl:right-[411px]"
    >
      {items.map((item) => (
        <span
          key={item.id}
          className="ws-reaction bottom-10 flex flex-col items-center gap-1"
          style={
            {
              left: `${item.left}%`,
              ["--rx" as string]: `${item.drift}px`,
              ["--rr" as string]: `${item.rotate}deg`,
              ["--rd" as string]: `${item.duration}s`,
            } as React.CSSProperties
          }
        >
          <span className="text-[52px] leading-none">{item.emoji}</span>
          {item.label && (
            <span className="max-w-30 truncate rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium leading-none text-white backdrop-blur-sm">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
