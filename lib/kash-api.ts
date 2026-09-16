"use client";

import { z } from "zod";
import { createServiceClient } from "@/lib/api/service";
import { api } from "./square-path.ts";

/**
 * The KASH transport, and the one read that crosses slice boundaries.
 *
 * ── WHY THIS IS IN `lib/` ───────────────────────────────────────────────────
 * The kash slice owns balances, quotes and the buy desk. But the ENGINE's
 * chain configuration — which token, on which chain — is needed by anything
 * that moves KASH, and tipping is the second such thing: a tip is a KSH
 * transfer the sender signs, so the tip flow needs the token address just as
 * the buy flow does. Slices never import each other (CLAUDE.md), and the
 * alternative — a second hook fetching the same endpoint under a different key
 * — is exactly the drift that rule exists to prevent. An api client is a
 * documented `lib/` concern, so the transport and the status read live here
 * and both slices read one cached answer.
 *
 * `breaker: false`: the engine is its own upstream behind its own proxy, and
 * three 502s from a balance poll must not open Market Square's shared circuit
 * breaker and tell the feed, messages and notifications that the square is
 * down.
 */
export const kashApi = createServiceClient(api("/api/kash"), {
  fallbackMessage: "KASH is unavailable right now.",
  breaker: false,
});

/**
 * `GET /status` — every live engine parameter.
 *
 * The half that matters here is `chain`: the token, and the chain it lives on.
 * Read from the SERVICE and never hard-coded, because a wrong token address is
 * a transfer into nothing.
 */
export const KashStatusSchema = z.object({
  price: z.object({ kashPriceUsd: z.string() }),
  /**
   * `mock` settles in the engine's ledger only; `ethers` moves real USDC and
   * therefore requires a verified on-chain payment before anything is minted.
   * The buy flow branches on this, so an unknown value degrades to the SAFE
   * side — treat it as real money and demand the payment.
   */
  treasury: z.object({ usdcMode: z.enum(["mock", "ethers"]).catch("ethers") }),
  chainMode: z.enum(["mock", "ethers", "off"]).catch("off"),
  /**
   * DELIBERATELY NOT PARSED: `status.coverage`.
   *
   * It reports treasury solvency for REDEMPTION — `paused` in production
   * today, with coverage at 12% — and nothing here may read it as a buy state.
   * A purchase adds USDC to the treasury rather than drawing on it, so gating
   * the buy button on coverage would halt the one direction that repairs the
   * number it is reporting. It is named here so the next reader does not
   * "helpfully" wire it up.
   */
  desk: z
    .object({
      purchaseMinUsdc: z.number().optional(),
      purchaseMaxUsdc: z.number().optional(),
    })
    .optional(),
  /**
   * Present only in `ethers` mode. `tokenAddress` is the KSH ERC-20 a tip
   * transfers; `paymentAddress` is where a buyer's USDC must go and
   * `usdcAddress` is the token to send it in. All read client-side because
   * every one of them is signed for by the holder, never by the platform.
   */
  chain: z
    .object({
      chainId: z.number(),
      tokenAddress: z.string().optional(),
      controllerAddress: z.string().optional(),
      paymentAddress: z.string().optional(),
      usdcAddress: z.string().optional(),
    })
    .optional(),
});

export type KashStatus = z.infer<typeof KashStatusSchema>;

/** Public. Every live parameter, including the token a tip moves. */
export async function getKashStatus(): Promise<KashStatus> {
  return KashStatusSchema.parse(await kashApi.get("/status"));
}

/**
 * The shared query key.
 *
 * Exported so every caller uses the SAME one: two keys for one endpoint is two
 * requests and two answers that can disagree.
 */
export const KASH_STATUS_KEY = ["kash", "status"] as const;
