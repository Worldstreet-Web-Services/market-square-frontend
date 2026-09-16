"use client";

import { apiFetch } from "@/lib/api/client";
import { apiError } from "@/lib/api/envelope";
import { BUY_ORIGIN, parseDestinations, type BuyRoute } from "@/lib/buy-routes";
import { QuoteError, normaliseQuote, type BuyQuote } from "@/lib/buy-quote";
import { api } from "../../../lib/square-path.ts";

/**
 * The routing provider, through our own proxy at `/api/dextopus`.
 *
 * NOT `msApi`. This is a different upstream with a different envelope — the
 * provider answers its own JSON and the proxy passes it through verbatim
 * rather than wrapping it in `{ success, data }` only to unwrap it again here.
 * So this file does its own status handling, and does it explicitly, because
 * the failures on this path end in somebody's money.
 *
 * `breaker: false` throughout: the provider is not Market Square, and its
 * outage must not open the shared circuit breaker and take the feed down with
 * it.
 */

async function providerFetch<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await apiFetch(api(`/api/dextopus/${path}`), init, { breaker: false });
  const body = (await res.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: { code?: string; message?: string }; message?: string })
    | null;
  if (!res.ok) {
    // The proxy's own refusals carry our envelope (an unconfigured key answers
    // 404 NOT_FOUND, which the buy surface reads as "not available here"); the
    // provider's carry a bare `message`. Keep whichever exists rather than
    // flattening both into a generic failure.
    const code = body?.error?.code ?? (res.status === 404 ? "NOT_FOUND" : "PROVIDER_ERROR");
    const message = body?.error?.message ?? (typeof body?.message === "string" ? body.message : fallback);
    throw apiError(code, message, res.status);
  }
  return body as T;
}

/** Every token and chain the provider can deliver USDC-on-Base into. */
export async function fetchBuyDestinations(): Promise<BuyRoute[]> {
  const params = new URLSearchParams({
    originChainId: String(BUY_ORIGIN.chainId),
    originAddress: BUY_ORIGIN.asset,
  });
  return parseDestinations(
    await providerFetch<unknown>(
      `deposit/destinations?${params.toString()}`,
      {},
      "Couldn't load what's buyable."
    )
  );
}

export interface BuyQuoteInput {
  route: BuyRoute;
  /** USDC to spend, in base units. Never a float, never a display string. */
  amount: bigint;
  /** The reader's own wallet on the destination chain — where the token lands. */
  recipient: string;
  /** Refunded here if the order cannot complete. */
  refundTo: string;
  slippageBps: number;
}

/**
 * The quote body.
 *
 * `amount` is the exact integer base-unit string. The quote is EXACT_INPUT:
 * the deposit address expects precisely this amount, and sending a different
 * one is an under- or over-payment that refunds rather than settling. So the
 * same bigint that is quoted is the one that is transferred, with no
 * re-parsing in between.
 */
function buildBuyQuoteBody(input: BuyQuoteInput) {
  return {
    originChainId: BUY_ORIGIN.chainId,
    originAsset: BUY_ORIGIN.asset,
    destinationChainId: input.route.destinationChainId,
    destinationAsset: input.route.asset,
    amount: input.amount.toString(),
    recipient: input.recipient,
    refundTo: input.refundTo,
    slippageBps: input.slippageBps,
  };
}

export async function fetchBuyQuote(input: BuyQuoteInput): Promise<BuyQuote> {
  const raw = await providerFetch<Record<string, unknown>>(
    "deposit/quote",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBuyQuoteBody(input)),
    },
    "Couldn't price that order."
  );
  try {
    return normaliseQuote(raw, input.route.decimals);
  } catch (error) {
    // A quote missing what a payment needs is the PROVIDER failing, not the
    // reader — surfaced as our own error shape so the sheet says something
    // specific rather than falling through to a generic failure.
    if (error instanceof QuoteError) throw apiError("PROVIDER_ERROR", error.message, 502);
    throw error;
  }
}

export interface OrderStatusResult {
  status: string;
  executionStatus: string;
  originTransactionHashes: string[];
  destinationTransactionHashes: string[];
  /** Set by our proxy when it could not reach the provider at all. */
  providerUnavailable?: boolean;
}

export async function fetchOrderStatus(requestId: string): Promise<OrderStatusResult> {
  const raw = await providerFetch<Record<string, unknown>>(
    `deposit/status?depositRequestId=${encodeURIComponent(requestId)}`,
    {},
    "Couldn't check the order."
  );
  return {
    status: typeof raw.status === "string" ? raw.status : "",
    executionStatus: typeof raw.executionStatus === "string" ? raw.executionStatus : "",
    originTransactionHashes: Array.isArray(raw.originTransactionHashes)
      ? raw.originTransactionHashes.filter((h): h is string => typeof h === "string")
      : [],
    destinationTransactionHashes: Array.isArray(raw.destinationTransactionHashes)
      ? raw.destinationTransactionHashes.filter((h): h is string => typeof h === "string")
      : [],
    providerUnavailable: raw.providerUnavailable === true,
  };
}
