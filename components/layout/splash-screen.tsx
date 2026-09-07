"use client";

import { useEffect, useState } from "react";
import { SquareMark } from "@/components/ui/square-mark";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/cn";

/**
 * THE BOOT SPLASH — Desktop 24, 26, 25 and 27.
 *
 * Read from the file's own PROTOTYPE, not inferred from four stills:
 *
 *     24  hold 800ms  -> SMART_ANIMATE 300ms EASE_IN_AND_OUT -> 26
 *     26  hold 800ms  -> SMART_ANIMATE 300ms EASE_IN_AND_OUT -> 25
 *     25  hold 800ms  -> SMART_ANIMATE 300ms EASE_IN_AND_OUT -> 27
 *     27  no interaction — it ENDS there
 *
 * So it is a FINITE 3.3-second sequence that comes to rest on the purple frame,
 * and each move is a continuous tween of scale AND colour together — Figma's
 * smart-animate interpolates matching layers, so there is no cut anywhere in it.
 * The whole timeline lives in `globals.css`; see the note there for how the
 * keyframe stops map onto those timings.
 *
 * The mark is drawn ONCE and scaled by transform, so the sequence stays on the
 * compositor — no layout, no paint, nothing that can stutter on a phone during
 * the one moment the app is already busy booting.
 *
 * ─── IT CAN NEVER TRAP ANYBODY ───────────────────────────────────────────────
 * A splash that covers the app is a splash that can hide a broken one. So:
 *
 *   · it leaves the moment auth resolves, and
 *   · it leaves at `MAX_MS` regardless, even if nothing ever resolves.
 *
 * The second is the important one. If Privy hangs, or the network is gone, the
 * reader gets the app and its own error states rather than a beautiful purple
 * rectangle forever.
 *
 * `MIN_MS` is the opposite guard: on a warm load auth resolves in a few dozen
 * milliseconds, and a splash that strobes for one frame is worse than no splash.
 * Below that threshold it never appears at all — a scripted three-second intro
 * on a boot that took 90ms is three seconds of delay somebody did not ask for.
 * A slow boot gets the sequence; a fast one gets the app.
 *
 * ─── REDUCED MOTION ──────────────────────────────────────────────────────────
 * A full-screen element scaling 3.3x is exactly the kind of movement that
 * triggers vestibular symptoms. Under `prefers-reduced-motion` the mark rests on
 * the dark ground — the sequence's own first frame, held.
 */

/** Below this, the splash never appears — a one-frame flash is worse than none. */
const MIN_MS = 350;
/**
 * Hard ceiling. Nothing keeps this on screen past it, resolved or not.
 *
 * Comfortably past the sequence's 3.3s, so a slow boot sees the whole thing and
 * then rests on the last frame rather than being cut mid-tween.
 */
const MAX_MS = 5000;

export function SplashScreen() {
  const { ready } = useAuth();
  // Starts hidden. It appears only if boot is slow enough to be worth covering.
  const [show, setShow] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (gone) return;
    const appear = window.setTimeout(() => setShow(true), MIN_MS);
    const ceiling = window.setTimeout(() => setGone(true), MAX_MS);
    return () => {
      window.clearTimeout(appear);
      window.clearTimeout(ceiling);
    };
  }, [gone]);

  /*
    `ready` is DERIVED, not stored.

    Setting `gone` from an effect on `ready` would schedule a second render for
    something already knowable during the first — and once dismissed, `gone`
    keeps it dismissed even if `ready` ever flickered back. The timers above are
    genuinely asynchronous and belong in an effect; this does not.
  */
  if (gone || !show) return null;

  return (
    <div
      /*
        THE HAND-OFF IS THE ONE THING THE PROTOTYPE CANNOT SAY.

        It ends on frame 27 — a full purple screen — and has no frame for the app
        that comes next, so the join is ours to decide either way. A hard cut
        from that purple to the dark app is the kind of jump everybody notices,
        so it fades once auth is ready; 220ms, which is under the 300ms the
        sequence's own moves use, because leaving should be quicker than
        arriving. The element stays mounted for that beat and is
        `pointer-events-none` throughout it, so nothing underneath is blocked
        while it goes.

        Say the word and it becomes a cut — it is a judgement call, not a reading
        of the file.
      */
      onTransitionEnd={() => setGone(true)}
      // `aria-hidden` with a live region beside it: the mark says nothing to a
      // screen reader, and "Loading" said once is what a reader actually needs.
      className={cn(
        "ws-splash pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-opacity duration-[220ms]",
        ready ? "opacity-0" : "opacity-100"
      )}
    >
      <span role="status" className="sr-only">
        Loading Market Square
      </span>
      <div aria-hidden className="ws-splash-mark">
        <SquareMark width={583.54} palette={SPLASH_PALETTE} />
      </div>
    </div>
  );
}

/**
 * The splash's palette is the one place the mark inverts, and it does so
 * CONTINUOUSLY: every entry is a registered `<color>` custom property that the
 * `ws-splash-palette` keyframe tweens (see globals.css for why registration is
 * what makes that a tween rather than a snap at the midpoint).
 *
 * The mark is drawn at the sequence's BIGGEST frame (583.54, frame 27) and the
 * keyframes scale DOWN from there, so it never scales past 1x. A composited
 * layer rasterises once and stretches the bitmap, so drawing at the 176.03 base
 * and scaling UP by 3.3 would hand the reader a blurred mark for two thirds of
 * the sequence.
 */
const SPLASH_PALETTE = {
  cardA: "var(--splash-card-a)",
  cardB: "var(--splash-card-b)",
  bubbleA: "var(--splash-bubble-a)",
  bubbleB: "var(--splash-bubble-b)",
  ink: "var(--splash-ink)",
};
