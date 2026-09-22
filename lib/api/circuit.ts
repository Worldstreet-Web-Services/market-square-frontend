/**
 * The client's circuit breaker: what stops an outage becoming a storm.
 *
 * WHY THIS EXISTS. The app polls — stream presence, chat, unread, messages,
 * notifications — and every query retries twice on failure, and every request
 * goes through a Vercel function that waits on the upstream before giving up.
 * When the backend went down, those three multiplied: a poll that fires every
 * few seconds, times three attempts, times a function that sits there holding
 * memory until it times out, times every open tab. The clients did not notice
 * the backend was gone; each request found out on its own, over and over.
 *
 * A breaker makes that a shared fact. Once enough requests in a row have
 * failed the same way, the circuit OPENS and every subsequent call fails
 * instantly, in-process, with no network and no function invocation. One probe
 * is allowed through per cooldown to find out whether it is back.
 *
 * WHAT COUNTS AS A FAILURE is deliberately narrow: transport errors and 5xx.
 * A 401, a 404 or a validation error is the server working correctly and
 * telling us something — tripping on those would take the whole app down over
 * one bad request.
 *
 * Pure and framework-free so the state machine can be tested directly; the
 * clock is injected for the same reason.
 */

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitSnapshot {
  state: CircuitState;
  /** When the breaker will next allow a probe. Epoch ms; 0 when closed. */
  retryAt: number;
  /** Consecutive qualifying failures. Reset by any success. */
  failures: number;
}

export interface CircuitOptions {
  /** Consecutive failures before the circuit opens. */
  threshold: number;
  /** How long it stays open before a probe is allowed, in ms. */
  cooldownMs: number;
  /** Ceiling for the backoff applied to repeated failed probes. */
  maxCooldownMs: number;
}

export const DEFAULT_CIRCUIT: CircuitOptions = {
  // Three, not one: a single 502 is noise on any network, and opening on it
  // would flip the whole app into a degraded state over one dropped packet.
  threshold: 3,
  cooldownMs: 15_000,
  maxCooldownMs: 120_000,
};

/**
 * Status codes that mean "the server is broken", as opposed to "you are".
 *
 * No status at all is a transport failure — DNS, TCP, CORS, offline. 502, 503
 * and 504 are the gateway saying the thing behind it is not answering, which
 * is exactly the case this exists for, and a plain 500 counts too: sustained
 * 500s are an outage even if each one is technically "handled".
 *
 * AND 429, WHICH DID NOT COUNT. A rate limit is the server's own request to
 * stop, and we answered it by polling at exactly the same rate for as long as
 * the reader left the tab open. That is the one signal a backend has for
 * asking a client to back off, and ignoring it takes away its only way of
 * climbing out under its own power.
 *
 * A 429 is not an outage, so it does not deserve the same weight as one — but
 * the thing it needs is the same thing: fewer requests for a while. The
 * breaker is what the app already has for "fewer requests for a while".
 */
export function isCircuitFailure(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 429) return true;
  return status >= 500;
}

/**
 * May a request go out right now?
 *
 * ONE PROBE, WHICH IS WHAT THIS DID NOT DO. The comment here used to promise
 * "exactly one probe gets through" and the code admitted EVERYTHING: `onProbe`
 * relabelled the state and left `retryAt` in the past, so every queued request
 * in every tab passed the moment the cooldown lapsed.
 *
 * That fires at precisely the worst moment — when a restarted backend is three
 * seconds into being alive and every client's cooldown expires together. It is
 * the mechanism that turns a ninety-second restart into a ten-minute one, and
 * this app restarted its backend twice in one evening (2026-09-21).
 *
 * `retryAt` is now the gate in BOTH states: open means "not until then", and
 * half-open means "a probe is already out; not until its own cooldown lapses".
 * That second clause is what stops a probe that never answers — a hung
 * request, a closed tab — from wedging the circuit shut for ever.
 */
export function allowsRequest(snapshot: CircuitSnapshot, now: number): boolean {
  if (snapshot.state === "closed") return true;
  return now >= snapshot.retryAt;
}

export function onFailure(
  snapshot: CircuitSnapshot,
  now: number,
  options: CircuitOptions = DEFAULT_CIRCUIT
): CircuitSnapshot {
  const failures = snapshot.failures + 1;
  if (failures < options.threshold) return { state: "closed", retryAt: 0, failures };
  // Each further failure while open pushes the next probe out, doubling to a
  // ceiling: a backend that has been down for ten minutes does not need to be
  // asked every fifteen seconds.
  const rounds = failures - options.threshold;
  const cooldown = Math.min(options.cooldownMs * 2 ** rounds, options.maxCooldownMs);
  return { state: "open", retryAt: now + cooldown, failures };
}

export function onSuccess(): CircuitSnapshot {
  return { state: "closed", retryAt: 0, failures: 0 };
}

/**
 * A probe has just been let out: half-open, and the door shuts behind it.
 *
 * Advancing `retryAt` is the whole fix. Without it the state changed and the
 * gate did not, so the second request through the door was admitted for the
 * same reason the first was, and so was the thousandth.
 *
 * The next opening is a full cooldown away, not a doubled one: this is not a
 * failure, it is a probe whose answer has not arrived. `onFailure` does the
 * doubling if the answer turns out to be bad.
 */
export function onProbe(
  snapshot: CircuitSnapshot,
  now: number,
  options: CircuitOptions = DEFAULT_CIRCUIT
): CircuitSnapshot {
  if (snapshot.state !== "open") return snapshot;
  return { ...snapshot, state: "half-open", retryAt: now + options.cooldownMs };
}

export const CLOSED: CircuitSnapshot = { state: "closed", retryAt: 0, failures: 0 };
