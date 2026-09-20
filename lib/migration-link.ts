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
 *   · 200                          → linked. Square DOES now report itself, as
 *                                    `rekey.square` (not `market-square`); read
 *                                    it with `readSquareRekey` below.
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
 *   · 502 UPSTREAM_ERROR            → retry LATER. OURS, not the service's:
 *                                    the BFF mints it when the service is
 *                                    unreachable or its 15s timeout fires.
 *                                    The contract says nothing about it
 *                                    because it never reaches the contract,
 *                                    and a gateway blip read as "not deployed
 *                                    here" wipes the pending-link marker and
 *                                    abandons a link that never happened.
 *   · 503 "AUTH_PROVIDERS", a 503
 *     matching neither, our own
 *     NOT_CONFIGURED, anything else → quiet. Linking is not deployed here and
 *                                    asking again never helps. §5 is explicit
 *                                    that a 503 matching neither message is
 *                                    permanent, so it stays permanent.
 *
 * Dependency-free and alias-free so `node --test` runs it.
 */

export type LinkOutcome =
  | { kind: "linked" }
  | { kind: "already-linked" }
  | { kind: "reauth" }
  | { kind: "retry-later" }
  | { kind: "unavailable" };

/**
 * WHAT SQUARE SAYS ABOUT THE MOVE ITSELF — `rekey.square` on the link and the
 * status response.
 *
 * This did not used to exist. The link recorded the pairing and Square moved
 * the profile on a queue without reporting, so this page could only say "it
 * moves in the background" and hope. Square now answers for itself:
 *
 *   · done     the profile is at the new id. Their data is there NOW.
 *   · none     nothing to move — a Decane-native account. Also a finished
 *              answer, not a gap.
 *   · pending  the move is still in flight. The one state worth waiting on.
 *   · failed   Square refused: the new id already owns a real profile, so the
 *              person is split and a human has to decide. Reporting this as
 *              success is how somebody loses their followers quietly.
 *   · unknown  the field is absent — an older service, or a 409 SAME_WALLET
 *              that carries no rekey map. Treated as finished, because waiting
 *              on a service that will never answer is worse than not waiting.
 *
 * `ledger` is `square`, NOT `market-square`.
 */
export type SquareRekey = "done" | "none" | "pending" | "failed" | "unknown";

/** True once there is nothing left to wait for, whatever the answer was. */
export function squareSettled(state: SquareRekey): boolean {
  return state !== "pending";
}

/**
 * Reads `data.rekey.square` out of a link or status body. Total: any shape
 * that is not one of the five known words reads as `unknown`, so a service
 * that grows a new status can never strand the reader on a spinner.
 */
export function readSquareRekey(body: unknown): SquareRekey {
  if (!body || typeof body !== "object") return "unknown";
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object") return "unknown";
  const rekey = (data as { rekey?: unknown }).rekey;
  if (!rekey || typeof rekey !== "object") return "unknown";
  const square = (rekey as Record<string, unknown>).square;
  return square === "done" || square === "none" || square === "pending" || square === "failed"
    ? square
    : "unknown";
}

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
  // Our own BFF's "I could not reach the service", which the service contract
  // never sees and therefore never ruled on. Nothing was recorded, so it is
  // the same kind of answer as the transient 503 above.
  if (status === 502 && code === "UPSTREAM_ERROR") return { kind: "retry-later" };
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
