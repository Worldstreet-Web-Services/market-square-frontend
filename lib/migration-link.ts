/**
 * WHAT A LINK ATTEMPT MEANS — the one decision the old-account flow rests on.
 *
 * `POST /v1/migration/link` tells the platform "this Decane account is that
 * Privy account", and Square then moves the old profile — handle, followers,
 * posts, tips — onto the new id. The contract
 * (tsionark-monorepo/apps/market-square/llms-link.txt) answers with a handful
 * of statuses that LOOK alike and need opposite handling, so the reading lives
 * here, pure, pinned by `lib/migration-link.test.ts`:
 *
 *   · 200                          → linked. The strongest signal there is:
 *                                    Square never appears in `rekey`, so
 *                                    nothing may wait on `rekey["market-square"]`.
 *   · 409 SAME_WALLET              → linked. Both sessions are one account;
 *                                    a no-op, not a failure to report.
 *   · 409 LEGACY_ALREADY_LINKED    → stop. A person problem: one side is
 *                                    already paired with someone else. Say so
 *                                    once; never retry.
 *   · 401                          → sign in again. One of the two tokens did
 *                                    not verify.
 *   · 503 "retry shortly"          → retry LATER. Nothing was recorded; if
 *                                    this were swallowed the reader would keep
 *                                    an empty profile in silence.
 *   · 503 "AUTH_PROVIDERS", a 503
 *     matching neither, our own
 *     NOT_CONFIGURED, anything else → quiet. Linking is not deployed here and
 *                                    asking again never helps.
 *
 * Dependency-free and alias-free so `node --test` runs it.
 */

export type LinkOutcome =
  | { kind: "linked" }
  | { kind: "already-linked" }
  | { kind: "reauth" }
  | { kind: "retry-later" }
  | { kind: "unavailable" };

export function classifyLinkResponse(
  status: number,
  error: { code?: string; message?: string } | null | undefined
): LinkOutcome {
  if (status >= 200 && status < 300) return { kind: "linked" };
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (status === 409) {
    if (code === "SAME_WALLET") return { kind: "linked" };
    // Any other conflict is the same person problem; looping on it would be
    // exactly what the contract forbids.
    return { kind: "already-linked" };
  }
  if (status === 401) return { kind: "reauth" };
  if (status === 503 && /retry shortly/iu.test(message) && !/AUTH_PROVIDERS/u.test(message)) {
    return { kind: "retry-later" };
  }
  return { kind: "unavailable" };
}

/**
 * The retry marker: set when a link must be asked again at the next natural
 * moment (the page reopened, the next app open), cleared by any FINAL answer.
 * Never a timer — the contract is explicit that a tight loop is wrong.
 */
export function nextRetryMarker(outcome: LinkOutcome): "set" | "clear" | "keep" {
  if (outcome.kind === "retry-later") return "set";
  if (outcome.kind === "reauth") return "keep";
  return "clear";
}

/**
 * "A link still needs asking again", kept per browser. Read by the entry on
 * the signed-in /auth screen, so the reader coming back is the moment that
 * offers to finish — not a loop retrying behind their back.
 */
const RETRY_KEY = "ms:migration:link-pending";

export function applyRetryMarker(outcome: LinkOutcome): void {
  try {
    const next = nextRetryMarker(outcome);
    if (next === "set") localStorage.setItem(RETRY_KEY, "1");
    if (next === "clear") localStorage.removeItem(RETRY_KEY);
  } catch {
    // Storage blocked (or no browser): the entry simply does not highlight.
  }
}

export function linkRetryPending(): boolean {
  try {
    return localStorage.getItem(RETRY_KEY) === "1";
  } catch {
    return false;
  }
}
