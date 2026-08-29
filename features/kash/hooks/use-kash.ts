"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";
import { isPayableAmount, encodeErc20Transfer, usdcToBaseUnits } from "@/lib/erc20";
import { useEmbeddedWallet } from "@/hooks/use-wallet";
import { useEvmSend } from "@/hooks/use-evm-send";
import {
  getKashAccount,
  getKashDeskBuyQuote,
  getKashDeskInfo,
  getKashPurchaseQuote,
  getKashStatus,
  postKashDeskBuyTx,
  postKashDeskPrepareBuy,
  postKashPurchase,
  withDomainType,
} from "@/features/kash/lib/api";
import { clearHeldPayment, heldPayment, holdPayment } from "@/lib/payment-store";
import type { KashPurchase, KashStatus } from "@/features/kash/lib/types";

/**
 * Engine parameters move when ops act, not by the second, so a minute of
 * staleness is invisible and keeps the shared status read off the hot path.
 */
const STATUS_STALE_MS = 60_000;

/**
 * The account payload changes when the reader acts AND when something arrives
 * from outside the app — a settlement, KASH somebody sent them. Their own
 * actions invalidate explicitly; this interval exists for the outside changes,
 * which is exactly the case where somebody is staring at the number waiting.
 */
const ACCOUNT_POLL_MS = 15_000;

/**
 * Engine status: the price, the mode, and the addresses a purchase pays to.
 *
 * Public and wallet-free, so it is the one read that can answer "is KASH here
 * at all" for a signed-out visitor — and being shared and cached, forty
 * surfaces discover the answer once between them rather than each finding out
 * on its own.
 *
 * `retry: false`: a 404 cannot be retried into existence, and a dead engine
 * should not be asked three times per surface.
 */
export function useKashStatus() {
  return useQuery({
    queryKey: ["kash", "status"],
    queryFn: getKashStatus,
    staleTime: STATUS_STALE_MS,
    retry: false,
  });
}

/**
 * The reader's own KASH account. Disabled until there is a wallet, so a
 * signed-out visitor never fires an authed call that could only 401.
 */
export function useKashAccount() {
  const { address } = useEmbeddedWallet();

  const query = useQuery({
    queryKey: ["kash", "account", address],
    queryFn: () => getKashAccount(address as string),
    enabled: Boolean(address),
    refetchInterval: ACCOUNT_POLL_MS,
    retry: false,
  });

  return { ...query, wallet: address };
}

/**
 * What a dollar amount buys.
 *
 * NOT debounced here. The caller passes a SETTLED amount — a preset chip, or a
 * field the reader has stopped typing in — because the right delay is a
 * property of the surface, and a quote fired per keystroke is a request per
 * keystroke against a shared engine.
 */
export function useKashPurchaseQuote(usdcAmount: string, enabled = true) {
  return useQuery({
    queryKey: ["kash", "purchase-quote", usdcAmount],
    queryFn: () => getKashPurchaseQuote(usdcAmount),
    enabled: enabled && isPayableAmount(usdcAmount),
    retry: false,
  });
}

/**
 * The on-chain sale desk, when one is configured.
 *
 * Its mere existence switches the buy onto the one-signature flow. A 404 or a
 * 503 is a CONFIGURATION STATEMENT, not a transient fault — retrying cannot
 * configure a desk — so it is asked once and the two-step flow applies.
 */
export function useKashDeskInfo(enabled: boolean) {
  return useQuery({
    queryKey: ["kash", "desk"],
    queryFn: getKashDeskInfo,
    enabled,
    staleTime: STATUS_STALE_MS,
    retry: false,
  });
}

export function useKashDeskBuyQuote(usdcAmount: string, enabled: boolean) {
  return useQuery({
    queryKey: ["kash", "desk-quote", usdcAmount],
    queryFn: () => getKashDeskBuyQuote(usdcAmount),
    enabled: enabled && isPayableAmount(usdcAmount),
    retry: false,
  });
}

/** Refresh every KASH read at once, after something has changed the balance. */
export function useInvalidateKash() {
  const queryClient = useQueryClient();
  return () => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["kash"] });
    refresh();
    /**
     * A mint is confirmed by the time the engine answers, but the node it
     * reads balances from can still be a block behind. Asking again shortly
     * afterwards is what stops a successful purchase from appearing to have
     * done nothing.
     */
    [2_500, 6_000].forEach((delay) => setTimeout(refresh, delay));
  };
}

/** How far along a buy is — for a button that must never be optimistic. */
export type BuyPhase =
  | "idle"
  /** Waiting on the reader's wallet: a permit signature or a send. */
  | "signing"
  /** The transaction is on-chain and we are waiting for it to be mined. */
  | "confirming"
  /** Paid. Telling the engine to credit it. */
  | "crediting";

export interface KashBuyInput {
  wallet: string;
  usdcAmount: string;
  /** Minted where the reader's intent began, and unchanged across retries. */
  intentKey: string;
  /** Identifies this attempt, so a held payment can be matched to it. */
  holdKey: string;
  status: KashStatus;
  /** True when a live sale desk supersedes the two-step flow. */
  useDesk: boolean;
  onPhase: (phase: BuyPhase) => void;
}

export interface KashBuyResult {
  kashReceived: string | null;
  txHash: string | null;
  /**
   * The engine had already credited this payment.
   *
   * A success, not a failure: the reader's money moved and their KASH exists.
   * It reaches us as a CONFLICT because a retry re-presented a transaction hash
   * the engine had already settled — which is precisely the guard working.
   */
  alreadyCredited: boolean;
}

/**
 * Buy KASH.
 *
 * TWO FLOWS, and which one applies is the engine's decision, not ours.
 *
 * **Desk (one signature).** The backend prices the trade, builds the exact
 * EIP-712 permit payload, and encodes the transaction; the reader signs and
 * submits it. USDC leaves their wallet and freshly minted KASH arrives in the
 * same transaction, so there is no separate payment to hold — nothing can be
 * paid without also being received.
 *
 * **Two-step (pay, then credit).** The reader transfers USDC to the engine's
 * payment address and the engine verifies that transfer before minting. Only
 * the first step moves money, so the transaction hash is held the instant it
 * settles and reused by every retry of the same attempt
 * (`lib/payment-store.ts`). Without that, a failed credit followed by a second
 * press is two payments and one purchase.
 *
 * `onPhase` is reported at every boundary because the button must be disabled
 * for the whole of it. An optimistic buy button is a second payment waiting to
 * happen.
 */
export function useKashBuy() {
  const invalidate = useInvalidateKash();
  const { send, waitForReceipt, signTypedData } = useEvmSend();

  return useMutation<KashBuyResult, unknown, KashBuyInput>({
    mutationFn: async (input) => {
      const { wallet, usdcAmount, intentKey, holdKey: key, status, useDesk, onPhase } = input;

      if (useDesk) {
        onPhase("signing");
        const prepared = await postKashDeskPrepareBuy(wallet, usdcAmount);
        const signature = await signTypedData(
          wallet,
          withDomainType(prepared.typedData) as unknown as Record<string, unknown>
        );
        const tx = await postKashDeskBuyTx({
          wallet,
          usdcAmount,
          deadline: prepared.deadline,
          signature,
          idempotencyKey: intentKey,
        });
        const txHash = await send({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          chainId: tx.chainId,
        });
        onPhase("confirming");
        const outcome = await waitForReceipt(txHash);
        if (outcome === "reverted") throw new Error("The purchase transaction failed on-chain.");
        return {
          kashReceived: prepared.quote?.kashOut ?? null,
          txHash,
          alreadyCredited: false,
        };
      }

      /**
       * Does this purchase need a real, verified payment first?
       *
       * The engine answers that, through its own mode. In `mock` it settles in
       * its ledger and no token moves; in `ethers` it refuses to mint without a
       * transfer it can verify came FROM this wallet. Guessing either way is a
       * purchase that silently does nothing or a payment that is never credited
       * — so the decision is read from `/status`, never assumed.
       */
      const needsPayment = status.treasury.usdcMode === "ethers";
      let paymentTxHash: string | undefined;

      if (needsPayment) {
        const paymentAddress = status.chain?.paymentAddress;
        const usdcAddress = status.chain?.usdcAddress;
        const chainId = status.chain?.chainId;
        if (!paymentAddress || !usdcAddress || chainId === undefined) {
          // Not a guess we are allowed to make. Without the engine's own
          // addresses there is nowhere to pay, and inventing one sends real
          // money to a stranger.
          throw new Error("KASH purchases aren't configured on this environment yet.");
        }

        // Never pay twice for one attempt: a receipt the previous try produced
        // is the payment, and this try only has to credit it.
        paymentTxHash = heldPayment("kash", wallet, key)?.txHash;

        if (!paymentTxHash) {
          onPhase("signing");
          const hash = await send({
            to: usdcAddress as `0x${string}`,
            data: encodeErc20Transfer(paymentAddress, usdcToBaseUnits(usdcAmount)),
            chainId,
          });
          /**
           * Held BEFORE the confirmation wait, not after.
           *
           * The transaction is already broadcast at this point. If the wait
           * times out, or the tab closes, or the credit below fails, the money
           * may well have moved — and the only thing that makes the next
           * attempt safe is that this hash was written down first.
           */
          holdPayment("kash", wallet, { key, txHash: hash });
          paymentTxHash = hash;

          onPhase("confirming");
          const outcome = await waitForReceipt(hash);
          if (outcome === "reverted") {
            // Nothing moved, so nothing may be reused: a reverted transfer
            // must never be offered to the engine as a payment.
            clearHeldPayment("kash", wallet);
            throw new Error("The payment failed on-chain. Nothing was charged.");
          }
        }
      }

      onPhase("crediting");
      try {
        const purchase: KashPurchase = await postKashPurchase({
          wallet,
          usdcAmount,
          paymentTxHash,
          idempotencyKey: intentKey,
        });
        // Credited — the receipt has been consumed and must not be reused.
        clearHeldPayment("kash", wallet);
        return {
          kashReceived: purchase.kashReceived,
          txHash: purchase.mintTxHash ?? paymentTxHash ?? null,
          alreadyCredited: false,
        };
      } catch (error) {
        /**
         * `payment_already_used` — the engine has already settled this hash.
         *
         * That is a SUCCESS wearing an error's clothes: the money moved and the
         * KASH exists; a previous attempt's response was simply lost. Reporting
         * it as a failure would tell somebody their purchase did not happen
         * while their balance says otherwise, and would leave a spent receipt
         * held for a future attempt to trip over.
         */
        if (errorCode(error) === "CONFLICT") {
          clearHeldPayment("kash", wallet);
          return { kashReceived: null, txHash: paymentTxHash ?? null, alreadyCredited: true };
        }
        // Everything else: the receipt deliberately SURVIVES. The money may
        // already have moved, and the next attempt must credit that payment
        // rather than make another.
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}
