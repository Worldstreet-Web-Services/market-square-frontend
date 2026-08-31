/**
 * Pools heart taps so the tally can be recorded without a request per tap.
 *
 * A heart is meant to be hammered — that is the entire gesture, and it is why
 * the room draws them as a shower rather than incrementing a label. But the
 * count has to be WRITTEN somewhere to survive the moment the animation is
 * about, and one write per tap would put thirty requests a second on the wire
 * for one enthusiastic thumb.
 *
 * So taps accumulate here and leave in bursts. The viewer loses nothing by it:
 * their heart already flew the instant they tapped, and the tally beside it
 * already moved. Only the durable write is delayed, and only by about a
 * second.
 *
 * Nothing is DROPPED. A thumb faster than `maxBurst` leaves a remainder, and
 * the remainder goes out on the next tick rather than being discarded — a
 * tap-and-hold is counted in full. That is the difference between this and the
 * data channel next door, which drops hearts under congestion on purpose: a
 * late heart is worse than no heart, but an uncounted one is just wrong.
 *
 * Timers are injected rather than reached for, so the behaviour above is
 * testable without waiting real seconds for it.
 */

/** Most hearts one request may carry. Mirrors the service's own cap. */
export const MAX_REACTION_BURST = 10;

/** How long taps pool before one request carries them. */
export const REACTION_FLUSH_MS = 1000;

export interface ReactionBufferOptions {
  /** Send one burst. Called with at least 1 and at most `maxBurst`. */
  send: (burst: number) => void;
  schedule?: (fn: () => void, ms: number) => number;
  cancel?: (handle: number) => void;
  flushMs?: number;
  maxBurst?: number;
}

export interface ReactionBuffer {
  /**
   * Count `burst` taps. Returns how many were actually taken, which is what
   * the caller should add to its optimistic tally — clamping here and
   * counting something else on screen would drift the two apart.
   */
  add: (burst?: number) => number;
  /** Taps counted but not yet sent. */
  pending: () => number;
  /** Stop the pending timer. Anything unsent stays unsent. */
  dispose: () => void;
}

export function createReactionBuffer({
  send,
  schedule = (fn, ms) => setTimeout(fn, ms) as unknown as number,
  cancel = (handle) => clearTimeout(handle),
  flushMs = REACTION_FLUSH_MS,
  maxBurst = MAX_REACTION_BURST,
}: ReactionBufferOptions): ReactionBuffer {
  let pending = 0;
  let handle: number | null = null;

  const flush = (): void => {
    handle = null;
    const take = Math.min(pending, maxBurst);
    if (take < 1) return;
    pending -= take;
    send(take);
    // The remainder of a fast thumb, rather than a silent truncation.
    if (pending > 0) handle = schedule(flush, flushMs);
  };

  return {
    add(burst = 1) {
      const capped = Math.min(Math.max(Math.floor(burst), 1), maxBurst);
      pending += capped;
      if (handle === null) handle = schedule(flush, flushMs);
      return capped;
    },
    pending: () => pending,
    dispose() {
      if (handle !== null) cancel(handle);
      handle = null;
    },
  };
}
