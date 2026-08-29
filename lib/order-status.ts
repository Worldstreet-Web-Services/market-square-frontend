/**
 * What an in-flight order is DOING, in words a reader can act on.
 *
 * The routing provider reports two independent strings — `status` and
 * `executionStatus` — whose vocabularies overlap, drift with their own
 * releases, and are written for an operator. Neither is safe to render, and
 * neither alone is complete: one can say "PENDING" while the other has already
 * said "REFUNDED".
 *
 * So both are collapsed into one stage by taking whichever is FURTHEST along,
 * matched on substrings rather than an exact enum. A vocabulary we do not
 * recognise degrades to "waiting", which is the only honest default: it claims
 * nothing, and the poll keeps running. Recognising a status we have never seen
 * as "settled" would tell somebody their money arrived on the word of a string
 * nobody checked.
 *
 * Ported from wsws's `lib/deposit.ts`. Pure and dependency-free so
 * `node --test` pins it — this is the function that decides whether a person is
 * told their purchase completed.
 */

export type OrderStage = "waiting" | "detected" | "processing" | "settled" | "refunded" | "failed";

export interface OrderProgress {
  stage: OrderStage;
  /** 0–100, for the progress bar. */
  pct: number;
  /** Reader-facing, deliberately free of bridging and settlement jargon. */
  label: string;
  /** True when nothing further will happen and polling should stop. */
  terminal: boolean;
}

/**
 * How far along each stage is, so two half-known statuses can be compared.
 * The three terminal stages share a rank because they are alternatives, not a
 * sequence — none of them supersedes another.
 */
const STAGE_RANK: Record<OrderStage, number> = {
  waiting: 0,
  detected: 1,
  processing: 2,
  settled: 3,
  refunded: 3,
  failed: 3,
};

const STAGE_META: Record<OrderStage, { pct: number; label: string; terminal: boolean }> = {
  waiting: { pct: 10, label: "Placing your order", terminal: false },
  detected: { pct: 40, label: "Payment received", terminal: false },
  processing: { pct: 70, label: "Almost there", terminal: false },
  settled: { pct: 100, label: "Done — it's in your wallet", terminal: true },
  refunded: { pct: 100, label: "Refunded to your wallet", terminal: true },
  failed: { pct: 100, label: "The order didn't complete", terminal: true },
};

/**
 * One provider string as a stage, or null when it said nothing at all.
 *
 * Ordered most-specific first: `"REFUND_FAILED"` must read as failed rather
 * than refunded, and `"SETTLEMENT_PENDING"` must not match `settled` before
 * the pending branch is considered — so the failure vocabulary is tested
 * ahead of the success one.
 */
function stageOf(raw: string): OrderStage | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (/(fail|error|expired|invalid|rejected)/u.test(value)) return "failed";
  if (/refund/u.test(value)) return "refunded";
  if (/(settled|complete|success|filled|done|relayed|fulfilled)/u.test(value)) return "settled";
  if (/(process|bridg|relay|submit|inflight|in_flight|executing)/u.test(value)) {
    return "processing";
  }
  if (/(detect|deposit|received|confirm|found)/u.test(value)) return "detected";
  return "waiting";
}

/** Both provider strings, collapsed into the furthest-along stage. */
export function orderProgress(status: string, executionStatus = ""): OrderProgress {
  const a = stageOf(status);
  const b = stageOf(executionStatus);
  let stage: OrderStage = "waiting";
  if (a && b) stage = STAGE_RANK[a] >= STAGE_RANK[b] ? a : b;
  else stage = a ?? b ?? "waiting";
  return { stage, ...STAGE_META[stage] };
}

export const TERMINAL_STAGES: ReadonlySet<OrderStage> = new Set([
  "settled",
  "refunded",
  "failed",
]);

/** Did this order end with the reader holding what they paid for? */
export function isSettled(stage: OrderStage): boolean {
  return stage === "settled";
}
