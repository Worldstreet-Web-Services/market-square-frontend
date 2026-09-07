/**
 * The bars behind a voice note.
 *
 * ─── THESE ARE NOT AMPLITUDES, AND MUST NEVER BE PRESENTED AS ONE ────────────
 * The message payload carries `mediaUrl` and `mediaDurationSeconds` and
 * nothing else — no peaks array, no waveform blob. Computing a real envelope
 * means downloading and decoding the whole clip in the browser before the
 * bubble can paint, for a picture the reader does not act on.
 *
 * So the bars are a STABLE DECORATIVE SHAPE derived from the message id: the
 * same note always looks the same, two notes never look identical, and nothing
 * about the drawing claims to describe the audio. The one thing that IS real
 * is the fill — how far along the bars are lit tracks the element's actual
 * `currentTime`, so the progress a reader sees is the progress that exists.
 *
 * If the service ever sends peaks, `waveformBars` is the single call site to
 * replace and every consumer keeps working.
 */

/** The file draws a bar every 3px across roughly 150px of bubble. */
export const WAVEFORM_BARS = 34;

/** Nothing is drawn flat: a zero-height bar reads as a rendering fault rather
    than as quiet audio. */
const MIN_HEIGHT = 0.25;

/**
 * FNV-1a over the seed, stepped once per bar.
 *
 * Deliberately not `Math.random`: the bars must survive a re-render, a poll
 * tick and a remount, or the note visibly reshuffles itself every five seconds
 * while the reader looks at it.
 */
function hash(seed: string, step: number): number {
  let h = 0x811c9dc5 ^ step;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    // The classic 16777619 multiply, spelled out in shifts so it stays inside
    // 32 bits without ever becoming a float.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * Heights in 0..1, one per bar, deterministic in `seed`.
 *
 * An empty seed still yields a full set — a message with no id is a bug
 * somewhere upstream, and a voice note drawn as an empty box would hide it
 * behind what looks like a styling problem.
 */
export function waveformBars(seed: string, count: number = WAVEFORM_BARS): number[] {
  const bars = Math.max(1, Math.floor(count));
  const heights: number[] = [];
  for (let i = 0; i < bars; i += 1) {
    // 10 bits of the hash is plenty of shape and keeps the arithmetic integral
    // until the final divide.
    const raw = hash(seed, i) % 1024;
    heights.push(MIN_HEIGHT + (raw / 1023) * (1 - MIN_HEIGHT));
  }
  return heights;
}

/**
 * How many bars are behind the playhead.
 *
 * Clamped at both ends because `currentTime / duration` is neither bounded nor
 * defined in practice: a duration of 0 (metadata not loaded), a NaN
 * `currentTime` on a fresh element, and a `currentTime` fractionally past the
 * end at the moment of `ended` are all normal and none of them may light more
 * bars than exist or fewer than none.
 */
export function playedBars(count: number, progress: number): number {
  const bars = Math.max(0, Math.floor(count));
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  if (progress >= 1) return bars;
  return Math.round(progress * bars);
}

/** `currentTime / duration`, made safe. Zero rather than NaN or Infinity for
    every unusable pair, so a bubble whose metadata never loaded shows an
    unplayed note instead of a fully played one. */
export function playProgress(
  currentTime: number | null | undefined,
  duration: number | null | undefined
): number {
  if (!Number.isFinite(currentTime ?? NaN) || !Number.isFinite(duration ?? NaN)) return 0;
  const total = duration as number;
  const at = currentTime as number;
  if (total <= 0 || at <= 0) return 0;
  return Math.min(1, at / total);
}
