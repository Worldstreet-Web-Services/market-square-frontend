/**
 * The proxy's own breaker, and the reason it exists SEPARATELY from the
 * client's.
 *
 * The client breaker stops one tab hammering a dead backend. This one stops
 * the FUNCTION doing it — and that is where the bill came from. Every call
 * here is a serverless invocation, and on Vercel's fluid compute the CPU
 * clock pauses while a fetch waits but PROVISIONED MEMORY does not: a request
 * hanging fifteen seconds on an unreachable upstream is fifteen seconds of
 * billed memory that produced nothing. Multiply by every poll, every retry and
 * every open tab and that is an outage turning into an invoice.
 *
 * Open circuit ⇒ the handler returns 503 in about a millisecond without
 * touching the network. Same answer the caller would eventually have got,
 * roughly ten thousand times cheaper.
 *
 * Module state is per warm instance, not global, and that is fine: each
 * instance learns from its own traffic within a few requests, and an instance
 * that never sees a failure never opens. There is no coordination to get
 * wrong, no store to run, and nothing to clean up when it scales to zero.
 */

export interface UpstreamHealth {
  failures: number;
  openUntil: number;
}

/** Consecutive upstream failures before this instance stops calling out. */
export const FAILURE_THRESHOLD = 5;
/** How long it stays shut, per round, doubling to the ceiling. */
export const COOLDOWN_MS = 10_000;
export const MAX_COOLDOWN_MS = 60_000;

const state: UpstreamHealth = { failures: 0, openUntil: 0 };

export function upstreamIsOpen(now: number = Date.now()): boolean {
  return now < state.openUntil;
}

export function recordUpstreamFailure(now: number = Date.now()): void {
  state.failures += 1;
  if (state.failures < FAILURE_THRESHOLD) return;
  const rounds = state.failures - FAILURE_THRESHOLD;
  state.openUntil = now + Math.min(COOLDOWN_MS * 2 ** rounds, MAX_COOLDOWN_MS);
}

export function recordUpstreamSuccess(): void {
  state.failures = 0;
  state.openUntil = 0;
}

/** Test seam — the module owns one instance's health, so tests must reset it. */
export function resetUpstreamHealth(): void {
  state.failures = 0;
  state.openUntil = 0;
}

export function upstreamHealth(): UpstreamHealth {
  return { ...state };
}

/**
 * How long to wait on the upstream.
 *
 * Reads were waiting FIFTEEN seconds. Nothing in this app reads for fifteen
 * seconds — the service answers a feed page in tens of milliseconds — so that
 * ceiling never saved a real request; it only decided how long a broken one
 * would sit there being billed. Five is generous for a healthy call and cheap
 * for a dead one.
 *
 * Writes keep more room because a slow POST that gets cut off can leave the
 * reader unsure whether it happened, and uploads keep the long ceiling they
 * genuinely need.
 */
export function upstreamTimeoutMs(method: string, isMultipart: boolean): number {
  if (isMultipart) return 120_000;
  return method === "GET" || method === "HEAD" ? 5_000 : 15_000;
}
