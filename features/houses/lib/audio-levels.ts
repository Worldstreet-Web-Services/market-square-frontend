/**
 * Turning a raw audio level into something a person can read.
 *
 * `participant.audioLevel` is an instantaneous RMS. Rendered straight it
 * strobes: speech is not a continuous signal, it is bursts separated by gaps
 * shorter than a blink, and a ring driven by the raw number flickers at exactly
 * the frequency that reads as broken rather than alive.
 *
 * So it is smoothed asymmetrically — fast up, slow down. That is the standard
 * VU-meter attack/release shape and it is what makes a level breathe instead of
 * flash.
 *
 * Pure, no React, no SDK, no value imports (see seating.ts for why).
 * Pinned by lib/house-audio-levels.test.ts.
 */

/** Fast: a voice starting has to be visible on the frame it starts. */
export const ATTACK = 0.5;

/**
 * Slow: this is the number that makes the ring breathe.
 *
 * Symmetric smoothing (attack === release) was the first thing tried and it
 * still strobed — the gaps between syllables are long enough to drain a
 * fast-falling meter to zero.
 */
export const RELEASE = 0.12;

/**
 * A quiet speaker still reads as active.
 *
 * LiveKit's `isSpeaking` is the SFU's own voice-activity decision and it is
 * better than any threshold we could pick, so when it says somebody is talking
 * the arc is held at a visible minimum regardless of how softly. Without this,
 * a softly spoken person's ring sat at nearly nothing while they held the
 * floor.
 */
export const SILENCE_FLOOR = 0.18;

/**
 * Below this the arc is gone, not merely short.
 *
 * An exponential decay never reaches zero, so without a snap the ring would
 * keep a one-pixel stub of arc forever after somebody stopped talking — which
 * says "still speaking, very quietly" and is a lie.
 */
export const ZERO_SNAP = 0.02;

export function smooth(prev: number, raw: number, isSpeaking: boolean): number {
  const target = isSpeaking ? Math.max(raw, SILENCE_FLOOR) : raw;
  const k = target > prev ? ATTACK : RELEASE;
  const next = prev + (target - prev) * k;
  return next < ZERO_SNAP ? 0 : next;
}

/**
 * How often levels are sampled.
 *
 * 100ms — the cadence usePublisher's own mic meter already runs at, so the two
 * agree. Deliberately NOT requestAnimationFrame: a house is a long-lived
 * surface, often with the phone in a pocket, and holding the compositor awake
 * for a number that changes ten times a second is a battery cost with nothing
 * on the other side of it.
 */
export const LEVEL_INTERVAL_MS = 100;

/**
 * The talking line's four bars, from one level.
 *
 * DETERMINISTIC. The obvious alternative — random heights, the "equaliser"
 * every music app draws — is decoration pretending to be an instrument, and in
 * a room where the whole point is knowing who is talking, a readout that moves
 * when nothing is happening is worse than none.
 *
 * Bar i lights as the level crosses i/BARS, and each bar fades in across its
 * own fifth of the range rather than snapping on.
 */
export const METER_BARS = 4;
const BAND = 1 / METER_BARS;
/** Never fully dark: four invisible bars is not a meter, it is a gap. */
export const BAR_FLOOR = 0.15;

export function barOpacity(level: number, index: number): number {
  const raw = (level - index * BAND) / BAND;
  return Math.min(1, Math.max(BAR_FLOOR, raw));
}

/**
 * How long a voice must hold the floor before it is ANNOUNCED.
 *
 * The talking line updates on screen immediately — a sighted reader can follow
 * turn-taking at conversational speed. A screen reader cannot: `role="status"`
 * firing on every turn in a lively conversation produces a wall of "Ada. Tobi.
 * Ada. Kemi." that buries whatever is actually being said. Only the
 * announcement is debounced; the visible strip is not.
 */
export const ANNOUNCE_STABLE_MS = 2000;
