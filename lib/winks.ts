/**
 * The wink: who may send one, to whom, and how often.
 *
 * A wink is a one-tap "I find you interesting" addressed to a person rather
 * than to something they posted. That makes it a different object from a like
 * and a different hazard: it is UNSOLICITED, it arrives at somebody who did
 * not ask for it, and it costs the sender nothing. Unlimited winks are a spam
 * tool whose whole cost falls on the person receiving them.
 *
 * ─── WHERE THIS IS AUTHORITATIVE, AND WHERE IT IS NOT ────────────────────────
 * These rules run in the browser, so they are a COURTESY, not enforcement.
 * Anyone can open a console and post the route directly. The service must
 * carry the same two limits or they are not limits, and it is the only place
 * the second guarantee below can hold at all:
 *
 *   1. RATE — at most `WINK_BUDGET` winks in `WINK_WINDOW_MS`, and at most one
 *      wink to the same person per `WINK_COOLDOWN_MS`. The per-person cooldown
 *      is the one that matters: a budget alone still allows twelve winks at one
 *      person in a minute, which is the harassment case, not the spam case.
 *   2. BLOCKS — a wink from a blocked account must never ARRIVE. The client can
 *      only refuse to SEND (see `winkEligibility`), and only in the direction
 *      it can see: this viewer's own block list. Whether the recipient has
 *      blocked the sender is not something the sender's browser knows, must not
 *      be — telling a sender "you are blocked" hands them the confirmation
 *      blocking exists to withhold. The service has to drop it silently, in
 *      both directions, at delivery.
 *
 * `useWink` treats a 429 from the service as the truth and this module as the
 * pre-flight, exactly the way upload validation runs before a byte is sent
 * while the service still owns the cap.
 */

/** Winks allowed in one rolling window. */
export const WINK_BUDGET = 12;
/** The rolling window the budget is measured over. */
export const WINK_WINDOW_MS = 60 * 60 * 1000;
/**
 * How long before the same person can be winked again.
 *
 * A day, deliberately longer than the window. A wink says one thing once; if
 * it did not land, saying it eleven more times before lunch is not a stronger
 * signal, it is the thing people leave a product over.
 */
export const WINK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** One sent wink. Nothing about the recipient is kept beyond their id. */
export interface WinkRecord {
  targetId: string;
  at: number;
}

export type WinkRefusal =
  | "self"
  | "blocked"
  | "cooling-down"
  | "budget-spent"
  | "unavailable";

export type WinkEligibility =
  | { ok: true }
  | { ok: false; reason: WinkRefusal; retryAfterMs: number };

export interface WinkEligibilityInput {
  viewerId: string | null | undefined;
  targetId: string;
  /** True when the viewer has blocked this person. */
  targetBlocked: boolean;
  /** Winks this viewer has sent, most recent first or not — order is ignored. */
  sent: WinkRecord[];
  now: number;
  /** False once the service has answered "no such route". */
  available?: boolean;
}

/** Winks inside the rolling window, oldest first. */
export function winksInWindow(sent: WinkRecord[], now: number): WinkRecord[] {
  return sent
    .filter((record) => now - record.at < WINK_WINDOW_MS)
    .sort((a, b) => a.at - b.at);
}

/** The most recent wink at this person, if any. */
export function lastWinkAt(sent: WinkRecord[], targetId: string): number | null {
  const times = sent.filter((record) => record.targetId === targetId).map((record) => record.at);
  return times.length > 0 ? Math.max(...times) : null;
}

/**
 * May this viewer wink this person right now?
 *
 * ORDER IS THE POINT. Self and blocked come first because they are permanent
 * conditions and must never be reported as "try again in an hour" — a refusal
 * that implies waiting will help, when nothing will, sends the reader back.
 * The cooldown outranks the budget for the same reason: "you already winked
 * them" is the specific true answer, and "you're out of winks" would be a
 * vaguer one that happens also to be true.
 */
export function winkEligibility(input: WinkEligibilityInput): WinkEligibility {
  const { viewerId, targetId, targetBlocked, sent, now, available = true } = input;

  if (!available) return { ok: false, reason: "unavailable", retryAfterMs: 0 };
  // You cannot be interested in yourself, and a self-wink would notify nobody.
  if (viewerId && viewerId === targetId) {
    return { ok: false, reason: "self", retryAfterMs: 0 };
  }
  // The half of the block guarantee a browser can hold: never send INTO a
  // block this viewer set. The other half belongs to the service.
  if (targetBlocked) return { ok: false, reason: "blocked", retryAfterMs: 0 };

  const last = lastWinkAt(sent, targetId);
  if (last !== null && now - last < WINK_COOLDOWN_MS) {
    return { ok: false, reason: "cooling-down", retryAfterMs: WINK_COOLDOWN_MS - (now - last) };
  }

  const window = winksInWindow(sent, now);
  if (window.length >= WINK_BUDGET) {
    // The budget frees up when the OLDEST wink in the window ages out, not
    // when the window length elapses from now — this is a rolling window.
    const oldest = window[0]!.at;
    return { ok: false, reason: "budget-spent", retryAfterMs: WINK_WINDOW_MS - (now - oldest) };
  }

  return { ok: true };
}

/**
 * Record a sent wink, dropping anything that can no longer affect a decision.
 *
 * Pruning is not housekeeping: this list is persisted per device, and a wink
 * older than the cooldown is not evidence of anything. Returns a new array —
 * the caller's may be shared.
 */
export function recordWink(sent: WinkRecord[], targetId: string, now: number): WinkRecord[] {
  return [...sent.filter((record) => now - record.at < WINK_COOLDOWN_MS), { targetId, at: now }];
}

/** Has this viewer already winked this person inside the cooldown? */
export function hasWinked(sent: WinkRecord[], targetId: string, now: number): boolean {
  const last = lastWinkAt(sent, targetId);
  return last !== null && now - last < WINK_COOLDOWN_MS;
}

/** "in 4 minutes", "in about 3 hours" — coarse on purpose; this is not a timer. */
export function humaniseWait(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * What to tell the sender.
 *
 * "blocked" says nothing about the other person's state — it names only what
 * this viewer did, which is the only thing they are entitled to know.
 */
export function describeWinkRefusal(reason: WinkRefusal, retryAfterMs: number): string {
  switch (reason) {
    case "self":
      return "You can't wink yourself.";
    case "blocked":
      return "You've blocked them. Unblock to send a wink.";
    case "cooling-down":
      return `You've already winked them. You can again ${humaniseWait(retryAfterMs)}.`;
    case "budget-spent":
      return `That's your winks for now — more ${humaniseWait(retryAfterMs)}.`;
    case "unavailable":
      return "Winks aren't switched on yet.";
  }
}

/**
 * The service's own 429, converted to a wait.
 *
 * `error.details = { action, limit, windowSeconds, retryAfterSeconds }` is the
 * documented shape of a Market Square rate-limit error. Anything missing falls
 * back to our own window rather than to zero — telling someone to retry
 * immediately after a 429 just spends the next request.
 */
export function retryAfterFromDetails(details: unknown): number {
  const seconds = (details as { retryAfterSeconds?: unknown } | null)?.retryAfterSeconds;
  return typeof seconds === "number" && seconds > 0 ? seconds * 1000 : WINK_WINDOW_MS;
}
