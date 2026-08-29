/**
 * The quote, before anything is trusted about it.
 *
 * A quote is the instruction to pay: it names an address on Base and an exact
 * amount, and the transfer that follows is irreversible. So every field is
 * checked here rather than read optimistically at the call site — a quote
 * missing its deposit address is not a quote with a gap in it, it is a
 * transfer into nowhere waiting to be signed.
 *
 * Pure and dependency-free apart from its sibling `erc20`, so `node --test`
 * pins it.
 */

import { toBaseUnits } from "./erc20.ts";

export interface BuyQuote {
  /** Expected token received, in that token's base units. A PREVIEW. */
  estimatedOutput: bigint;
  /** Where the USDC must be sent, on Base. */
  depositAddress: string;
  /** What to poll the order's progress against. */
  requestId: string;
  /** How long the quoted address stays valid. */
  expiresInSeconds: number;
}

/** The provider's payload, before any of it has been believed. */
export interface RawQuote {
  depositRequestId?: unknown;
  depositAddress?: unknown;
  amountOut?: unknown;
  expiresInSeconds?: unknown;
}

export class QuoteError extends Error {}

/**
 * An output amount, which the provider may report either as integer base units
 * (`"38402"`) or as a human decimal (`"0.00038402"`).
 *
 * Base units are the live shape; the decimal branch exists because getting
 * this wrong by a factor of 10^8 produces a preview figure that looks
 * plausible and is not — and a preview is the only thing a reader can
 * sanity-check the order against.
 */
function parseOutput(value: string, decimals: number): bigint {
  const raw = value.trim();
  if (!raw) return 0n;
  if (raw.includes(".")) return toBaseUnits(raw, decimals);
  if (!/^\d+$/u.test(raw)) return 0n;
  return BigInt(raw);
}

/**
 * Validate a quote.
 *
 * Throws on the two fields a payment cannot proceed without, and only on
 * those. The estimated output degrades to zero — the caller shows no preview
 * rather than refusing an otherwise payable order over a cosmetic number.
 */
export function normaliseQuote(raw: RawQuote, decimals: number): BuyQuote {
  if (typeof raw?.depositAddress !== "string" || !raw.depositAddress.trim()) {
    throw new QuoteError("The quote came back without a deposit address.");
  }
  if (typeof raw.depositRequestId !== "string" || !raw.depositRequestId.trim()) {
    // Without this there is no way back to the order once it is paid for: the
    // money would be at an address the reader cannot see the progress of.
    throw new QuoteError("The quote came back without an order id.");
  }
  return {
    estimatedOutput:
      typeof raw.amountOut === "string" ? parseOutput(raw.amountOut, decimals) : 0n,
    depositAddress: raw.depositAddress.trim(),
    requestId: raw.depositRequestId.trim(),
    expiresInSeconds:
      typeof raw.expiresInSeconds === "number" && Number.isFinite(raw.expiresInSeconds)
        ? raw.expiresInSeconds
        : 0,
  };
}
