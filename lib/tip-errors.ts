/**
 * What a failed tip MEANS — the decision, separated from the request.
 *
 * Pure and pinned by `lib/tip-errors.test.ts`, the same way `follow-resolve`
 * holds the isFollowing decision: the rule below is the one that decides
 * whether a tip button disappears from every post on screen, and that is worth
 * being able to read and test on its own.
 */

/**
 * The 404 that means "not deployed" vs the 404 that means "no such recipient".
 *
 * The contract answers 404 for BOTH — an unknown recipient, and (today) the
 * route not existing at all. They demand opposite behaviour: one should quiet
 * the control everywhere, the other is a per-target error that must not touch
 * the other forty cards on screen. The only thing that can separate them is
 * the error CODE, so the rule is: a SPECIFIC code is the service talking about
 * a recipient; the bare `NOT_FOUND` is the proxy failing to find a route.
 *
 * That rule is safe in the wrong direction too. If the service ships and
 * answers a bare `NOT_FOUND` for a deleted post, the cost is one over-eager
 * quiet control until reload — never a tip claimed as sent. The reverse
 * default (treat every 404 as a real error) would leave a button on every post
 * that opens a sheet and fails, permanently, on a deployment where tipping
 * simply is not there yet.
 *
 * ASK THE BACKEND to answer `RECIPIENT_NOT_FOUND` and this stops being a
 * heuristic. The fixture handler already does, so fixture mode demonstrates
 * the contract we want rather than the ambiguity we have.
 */
const RECIPIENT_404_CODES = new Set([
  "RECIPIENT_NOT_FOUND",
  "POST_NOT_FOUND",
  "PROFILE_NOT_FOUND",
]);

export function isTipRouteMissing(code: string | null): boolean {
  if (code === null) return false;
  if (RECIPIENT_404_CODES.has(code)) return false;
  return code === "NOT_FOUND";
}

/**
 * Copy for the failures a tip can actually produce, keyed on the service's own
 * codes. Anything not listed falls through to the shared `errorMessage`.
 *
 * Every one of these says explicitly what happened to the money, because the
 * single worst outcome of this flow is someone not knowing whether they paid.
 */
export const TIP_ERROR_COPY: Record<string, string> = {
  SELF_TIP: "You can't tip your own post.",
  INSUFFICIENT_FUNDS: "Not enough KASH — top up and try again. Nothing was sent.",
  PAYMENT_FAILED: "The payment didn't go through. Nothing was sent.",
  RECIPIENT_NOT_FOUND: "That account can't receive tips right now.",
  RATE_LIMITED: "You've tipped a lot just now — give it a moment.",
  UNAUTHORIZED: "Sign in to send a tip.",
};
