/**
 * What a transaction receipt MEANS — the one place "it went through" is decided.
 *
 * A hash is not a payment. `eth_sendTransaction` resolving tells you the
 * transaction was accepted by a node, not that it was mined, and certainly not
 * that it succeeded: a reverted transaction has a receipt, a block number and a
 * gas cost, and moves nothing. Crediting an engine against a reverted transfer
 * would ask it to verify a payment that never happened, and telling the buyer
 * their purchase is in flight when it has already failed is worse still.
 *
 * So the three answers are kept distinct — not yet mined, mined and succeeded,
 * mined and reverted — and an unrecognised shape is "not yet", never "yes".
 * Pure and dependency-free; pinned by `lib/tx-receipt.test.ts`.
 */

export type TxOutcome = "pending" | "succeeded" | "reverted";

/**
 * `eth_getTransactionReceipt` answers `null` until the transaction is mined,
 * then an object whose `status` is `0x1` for success and `0x0` for a revert.
 * Only the field we act on is typed; the rest of the receipt is not our
 * business.
 */
export interface RawReceipt {
  status?: unknown;
  blockNumber?: unknown;
}

/**
 * A receipt with no `status` field at all is PENDING, not success.
 *
 * Pre-Byzantium receipts had no status, and so does anything that is not
 * actually a receipt — a malformed response, an error object a provider
 * returned with a 200. Every one of those is a thing we do not know, and the
 * only safe reading of "I do not know whether this payment succeeded" is to
 * keep waiting.
 */
export function receiptOutcome(receipt: RawReceipt | null | undefined): TxOutcome {
  if (!receipt || typeof receipt !== "object") return "pending";
  const { status } = receipt;
  if (typeof status === "string") {
    const normalised = status.trim().toLowerCase();
    if (normalised === "0x1" || normalised === "0x01" || normalised === "1") return "succeeded";
    if (normalised === "0x0" || normalised === "0x00" || normalised === "0") return "reverted";
    return "pending";
  }
  // Some providers hand back a decoded number rather than a quantity string.
  if (typeof status === "number") {
    if (status === 1) return "succeeded";
    if (status === 0) return "reverted";
  }
  return "pending";
}

/** Is this outcome final — is there any point asking again? */
export function isSettledOutcome(outcome: TxOutcome): boolean {
  return outcome !== "pending";
}
