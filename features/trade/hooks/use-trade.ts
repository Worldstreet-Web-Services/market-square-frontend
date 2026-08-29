"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { encodeErc20Transfer, usdcToBaseUnits } from "@/lib/erc20";
import { BUY_ORIGIN, type BuyRoute } from "@/lib/buy-routes";
import { orderProgress, TERMINAL_STAGES } from "@/lib/order-status";
import { clearHeldPayment, heldPayment, holdPayment } from "@/lib/payment-store";
import { useEmbeddedWallet } from "@/hooks/use-wallet";
import { useEvmSend } from "@/hooks/use-evm-send";
import { fetchBuyDestinations, fetchBuyQuote, fetchOrderStatus } from "@/features/trade/lib/api";

/**
 * A one-percent price tolerance, deliberately kept out of the interface.
 *
 * Slippage is a concept a reader tapping `$BTC` in a post has no reason to
 * hold. It is a real parameter with a real effect, so it is named here with
 * its reason rather than buried in a call site — but it is not a decision to
 * hand somebody who came here from a caption.
 */
const SLIPPAGE_BPS = 100;

/** How often to ask how an in-flight order is doing. */
const ORDER_POLL_MS = 4_000;

/**
 * The catalogue barely changes and every open buy sheet would otherwise ask
 * for it, so it is cached hard. It is also the read that tells a surface
 * whether buying exists here at all: a 404 means the provider is not
 * configured on this deployment.
 */
export function useBuyDestinations(enabled = true) {
  return useQuery({
    queryKey: ["trade", "destinations", BUY_ORIGIN.chainId, BUY_ORIGIN.asset],
    queryFn: fetchBuyDestinations,
    enabled,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // An unconfigured provider cannot be retried into existence.
    retry: false,
  });
}

/**
 * How an order is progressing.
 *
 * Polls until the stage is terminal and then STOPS — an order that has settled,
 * failed or refunded will not change again, and a poll that runs forever is a
 * request every four seconds for as long as the tab is open.
 */
export function useOrderStatus(requestId: string | null) {
  return useQuery({
    queryKey: ["trade", "order", requestId],
    queryFn: () => fetchOrderStatus(requestId as string),
    enabled: requestId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return ORDER_POLL_MS;
      const { stage } = orderProgress(data.status, data.executionStatus);
      return TERMINAL_STAGES.has(stage) ? false : ORDER_POLL_MS;
    },
  });
}

export interface TokenBuyInput {
  route: BuyRoute;
  /** The dollar amount as the reader entered it. Converted once, here. */
  usdcAmount: string;
  /** Identifies this attempt so a payment already made can be matched to it. */
  holdKey: string;
  onPhase: (phase: TokenBuyPhase) => void;
}

export type TokenBuyPhase = "idle" | "quoting" | "signing" | "confirming";

export interface TokenBuyResult {
  requestId: string;
  txHash: string;
  /** Expected token received, in that token's base units. A PREVIEW. */
  estimatedOutput: bigint;
  /** True when this attempt had already been paid for and was merely resumed. */
  resumed: boolean;
}

/**
 * Buy a listed token with USDC from the reader's own wallet.
 *
 * Three steps, and the order of them is the whole design:
 *
 *  1. **Quote.** The provider prices the route and mints a deposit address for
 *     this exact amount. The quote is EXACT_INPUT — the address expects
 *     precisely the quoted amount, so the same integer that was quoted is the
 *     one transferred, with no re-parsing in between.
 *  2. **Pay.** One ERC-20 transfer of USDC on Base, signed by the reader. The
 *     platform never holds their keys.
 *  3. **Track.** The provider bridges and delivers to the reader's own wallet
 *     on the destination chain, and `useOrderStatus` follows it.
 *
 * ── THE HOLD ───────────────────────────────────────────────────────────────
 * Between steps 2 and 3 the money has left the wallet and there is nothing on
 * screen yet. If the tab is reloaded there, a naive retry mints a NEW quote
 * with a NEW deposit address and sends a SECOND payment — two transfers, one
 * token. So the transaction hash AND the order id are written down the instant
 * the transfer is broadcast, and a retry of the same attempt resumes tracking
 * that order instead of starting another.
 *
 * The hold is cleared only when the order reaches a terminal stage, which is
 * the point at which there is nothing left to resume.
 */
export function useBuyToken() {
  const { address: wallet } = useEmbeddedWallet();
  const { send, waitForReceipt } = useEvmSend();

  return useMutation<TokenBuyResult, unknown, TokenBuyInput>({
    mutationFn: async ({ route, usdcAmount, holdKey: key, onPhase }) => {
      if (!wallet) throw new Error("Sign in to buy.");

      // Already paid for, and merely interrupted. Resume rather than re-pay.
      const held = heldPayment("token", wallet, key);
      if (held?.ref) {
        return {
          requestId: held.ref,
          txHash: held.txHash,
          estimatedOutput: 0n,
          resumed: true,
        };
      }

      onPhase("quoting");
      const amount = usdcToBaseUnits(usdcAmount);
      const quote = await fetchBuyQuote({
        route,
        amount,
        // The token lands in the reader's own wallet — the platform is never
        // the recipient. Every offerable route is EVM (`lib/buy-routes.ts`
        // excludes Solana precisely because we hold no wallet there), so the
        // one embedded address is both the recipient and the refund target.
        recipient: wallet,
        refundTo: wallet,
        slippageBps: SLIPPAGE_BPS,
      });

      onPhase("signing");
      const txHash = await send({
        to: BUY_ORIGIN.asset as `0x${string}`,
        data: encodeErc20Transfer(quote.depositAddress, amount),
        chainId: BUY_ORIGIN.chainId,
      });
      // Written BEFORE the confirmation wait: the transfer is already
      // broadcast, and from here on the only thing that makes a retry safe is
      // that this hash and this order id were recorded first.
      holdPayment("token", wallet, { key, txHash, ref: quote.requestId });

      onPhase("confirming");
      const outcome = await waitForReceipt(txHash);
      if (outcome === "reverted") {
        // Nothing moved, so there is nothing to resume and nothing to track.
        clearHeldPayment("token", wallet);
        throw new Error("The payment failed on-chain. Nothing was charged.");
      }

      return {
        requestId: quote.requestId,
        txHash,
        estimatedOutput: quote.estimatedOutput,
        resumed: false,
      };
    },
  });
}

/** The order is over; there is nothing left to resume. */
export function useClearTokenHold() {
  const { address: wallet } = useEmbeddedWallet();
  return () => {
    if (wallet) clearHeldPayment("token", wallet);
  };
}
