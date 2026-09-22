"use client";

import { cn } from "@/lib/cn";
import { useSeatLevel, type HouseAudio } from "@/features/houses/hooks/use-house-audio";

/**
 * The level arc: a METER, not a ring.
 *
 * With no picture of anybody's face, this is the room's only continuous
 * evidence that a particular person is the one making the sound. So it is
 * drawn as a quantity — an arc that grows clockwise from twelve o'clock in
 * proportion to how loudly that identity is talking — rather than as a binary
 * halo that is either on or off. A halo tells you somebody is speaking; a
 * meter tells you it is THIS person, and keeps telling you while they hold the
 * floor.
 *
 * Three channels carry the state, and only one of them is colour:
 *
 *   1. arc LENGTH — 0 at silence, a full circle at full voice
 *   2. stroke WEIGHT — 1px rest ring vs a 2px arc
 *   3. rest-ring BRIGHTNESS — 14% white, doubling to 28% while active
 *
 * Silver at 2px on --color-ground is roughly 11:1, comfortably past WCAG 2.2
 * SC 1.4.11's 3:1 for a state indicator — which the app's usual 8% white
 * hairline would fail outright.
 *
 * It subscribes to ONE identity through the level store, so a tick at 10Hz
 * repaints this circle and nothing else on the page. See use-house-audio.ts.
 */

/** Circumference of the r=38 arc. Named in globals.css too — ws-seat-sweep. */
export const SEAT_ARC = 238.76;

export function SeatMeter({
  audio,
  identity,
  /** Play the one full silver sweep that says "this microphone is now open". */
  landing = false,
}: {
  audio: HouseAudio;
  identity: string;
  landing?: boolean;
}) {
  const level = useSeatLevel(audio, identity);
  // Above the silence floor rather than "not zero": the rest ring should
  // brighten when somebody is HOLDING the floor, not on a cough.
  const active = level > 0.12;

  return (
    <svg
      viewBox="0 0 80 80"
      className="pointer-events-none absolute -inset-1 h-auto w-auto"
      aria-hidden
    >
      {/* The rest ring is always drawn, so the arc reads as growth from
          something rather than as an object appearing out of the black. */}
      <circle
        cx="40"
        cy="40"
        r="38"
        fill="none"
        strokeWidth="1"
        // The SVG scales to the avatar, so a user-unit stroke would thin out
        // with it — and a hairline that is 0.8px on one build and 1px on
        // another is a state indicator nobody can rely on.
        vectorEffect="non-scaling-stroke"
        className="transition-[stroke] duration-200 motion-reduce:transition-none"
        stroke={active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.14)"}
      />
      <circle
        cx="40"
        cy="40"
        r="38"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        stroke="var(--color-accent)"
        transform="rotate(-90 40 40)"
        strokeDasharray={SEAT_ARC}
        strokeDashoffset={SEAT_ARC * (1 - Math.min(1, Math.max(0, level)))}
        className={cn(
          // Under reduced motion the VALUE still updates — only the tween
          // between values goes. An arc that stops tracking the voice is a
          // broken instrument, not an accommodation.
          "transition-[stroke-dashoffset] duration-[120ms] ease-linear motion-reduce:transition-none",
          landing && "ws-seat-sweep"
        )}
      />
    </svg>
  );
}

/**
 * The talking line's four bars.
 *
 * Deterministic from the level: bar i lights as the level crosses i/4, fading
 * in across its own quarter of the range. The equaliser every music app draws
 * — random heights, always moving — is decoration pretending to be an
 * instrument, and in the one place whose entire job is "who is talking", a
 * readout that moves when nothing is happening is worse than none.
 */
export function LevelBars({ opacities }: { opacities: readonly number[] }) {
  const heights = [6, 10, 14, 10];
  return (
    <span className="flex shrink-0 items-end gap-[3px]" aria-hidden>
      {opacities.map((opacity, index) => (
        <span
          key={index}
          className="w-[3px] rounded-full bg-accent transition-opacity duration-[120ms] ease-linear motion-reduce:transition-none"
          style={{ height: heights[index], opacity }}
        />
      ))}
    </span>
  );
}
