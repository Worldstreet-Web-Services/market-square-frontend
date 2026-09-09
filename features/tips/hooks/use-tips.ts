"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";
import { isTipRouteMissing } from "@/lib/tip-errors";
import { fetchTipCapability, reportTipTransfer, sendTip } from "@/features/tips/lib/api";
import { KASH_TOKEN_DECIMALS } from "@/lib/kash-amount";
import { encodeErc20Transfer, toBaseUnits } from "@/lib/erc20";
import { holdKey } from "@/lib/payment-hold";
import { clearHeldPayment, heldPayment, holdPayment } from "@/lib/payment-store";
import { useEmbeddedWallet } from "@/hooks/use-wallet";
import { useEvmSend } from "@/hooks/use-evm-send";
import { useKashStatus } from "@/hooks/use-kash-status";
import { markTippingUnavailable, useTippingUnavailable } from "@/features/tips/lib/availability";
import type { Tip, TipTarget } from "@/features/tips/lib/types";

function isRouteMissing(error: unknown): boolean {
  return isTipRouteMissing(errorCode(error));
}

/**
 * The service's own tipping rules — and the read that nothing was making.
 *
 * `GET /tips/capability` publishes `{ enabled, minKash, maxKash,
 * verifiedAuthorsOnly }`, and the client shipped without ever asking. In
 * production the answer is min 1 KASH and verified authors only, while the
 * sheet defaulted to 0.05 and offered eight gift tiles under a whole KASH — so
 * the most natural tip a reader could send was refused by the server after
 * they had already confirmed it.
 *
 * Public and wallet-free, so one long-cached read serves every tip button on
 * screen. It is deliberately NOT retried into existence: a deployment without
 * the route answers 404, and `lib/tip-capability.ts` treats a missing
 * capability as permissive so a failed lookup can never take tipping down.
 */
export function useTipCapability() {
  return useQuery({
    queryKey: ["ms", "tips", "capability"],
    queryFn: fetchTipCapability,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });
}

/** How far along a tip is, so the sheet can say which step is happening. */
export type TipPhase = "idle" | "creating" | "signing" | "confirming" | "reporting";

export interface SendTipInput {
  target: TipTarget;
  amountKash: string;
  /** The gift the sender chose, so the recipient can see what arrived. */
  giftId?: string | null;
  onPhase?: (phase: TipPhase) => void;
}

/**
 * Send one tip — including, where the service asks for it, actually paying.
 *
 * There is NO optimistic update here, on purpose. Every other mutation in the
 * app flips a boolean the user can see and rolls it back on failure; a tip
 * moves money, and an optimistic receipt is a claim that a payment happened.
 * The receipt is rendered from the SERVER's response — its `tipId`, its
 * `amountKash`, its `status` — or it is not rendered at all.
 *
 * ── TWO SETTLEMENTS ────────────────────────────────────────────────────────
 * On a rail that can transfer, `POST /tips` moves the money and comes back
 * confirmed; there is nothing else to do. On the real rail it cannot — the
 * kash rail exposes mint and burn and no transfer, and the platform is
 * non-custodial — so the response carries the author's WALLET instead, and the
 * sender's own wallet signs a KSH transfer to it. The tip stays PENDING until
 * kash's watcher sees that transfer on-chain, which is a genuine wait and is
 * reported as one.
 *
 * ── WHY THE HASH IS HELD ───────────────────────────────────────────────────
 * Between the transfer landing and the service being told about it, the sender
 * has paid and nothing records it. A retry there would create a second tip and
 * pay a second time. So the hash is written down the instant it exists
 * (`lib/payment-store.ts`), and a retry of the same attempt reports the held
 * payment instead of making another. The service's own one-in-flight guard
 * closes the loop: a retry that races it is told which tip is already open,
 * and the held hash is reported against THAT tip.
 */
export function useSendTip() {
  const queryClient = useQueryClient();
  const unavailable = useTippingUnavailable();
  const { address: wallet } = useEmbeddedWallet();
  const { send, waitForReceipt } = useEvmSend();
  const chain = useKashStatus().data?.chain ?? null;

  const mutation = useMutation<Tip, unknown, SendTipInput>({
    mutationFn: async ({ target, amountKash, giftId, onPhase }) => {
      const phase = onPhase ?? (() => {});
      const key = holdKey(`tip:${target.kind}:${target.id}`, amountKash);

      /**
       * A payment this attempt already made.
       *
       * Present only when a previous try transferred and then failed to report
       * it. Read before anything else, so the recovery path never starts by
       * creating a second tip.
       */
      const held = wallet && key ? heldPayment("tip", wallet, key) : null;

      phase("creating");
      let created;
      try {
        created = await sendTip(target, amountKash, giftId ?? null);
      } catch (error) {
        /**
         * The service already has a tip open for this post and sender — which
         * is exactly the state a failed report leaves behind. If we are
         * holding a payment for this attempt, it belongs to THAT tip: report
         * it rather than asking the sender to pay again.
         */
        const openTipId = (error as { details?: { tipId?: unknown } })?.details?.tipId;
        if (held?.ref && typeof openTipId === "string" && openTipId === held.ref) {
          phase("reporting");
          const reported = await reportTipTransfer(target, openTipId, held.txHash);
          if (wallet) clearHeldPayment("tip", wallet);
          return reported;
        }
        throw error;
      }

      // Rail settlement: the money moved server-side and the tip is done.
      if (!created.toWallet) return created.tip;

      // Client settlement: the sender pays, from their own wallet.
      if (!wallet) throw new Error("Sign in to send a tip.");
      if (!chain?.tokenAddress) {
        // Without the engine's own token address there is nothing to transfer
        // and guessing one sends real money into nothing.
        throw new Error("Tipping isn't configured on this environment yet.");
      }

      // A held hash is one this app produced, so it is already 0x-prefixed.
      let txHash = (held?.txHash ?? null) as `0x${string}` | null;
      if (!txHash) {
        phase("signing");
        txHash = await send({
          to: chain.tokenAddress as `0x${string}`,
          // The TOKEN's precision, not the API's — see KASH_TOKEN_DECIMALS.
          data: encodeErc20Transfer(
            created.toWallet,
            toBaseUnits(created.tip.amountKash, KASH_TOKEN_DECIMALS),
          ),
          chainId: chain.chainId,
        });
        /**
         * Written BEFORE the confirmation wait. The transfer is already
         * broadcast; from here the only thing that makes a retry safe is that
         * this hash and the tip it belongs to were recorded first.
         */
        if (key) holdPayment("tip", wallet, { key, txHash, ref: created.tip.tipId });

        phase("confirming");
        const outcome = await waitForReceipt(txHash, chain.chainId);
        if (outcome === "reverted") {
          // Nothing moved, so nothing may be reported as payment.
          clearHeldPayment("tip", wallet);
          throw new Error("The transfer failed on-chain. Nothing was sent.");
        }
      }

      phase("reporting");
      const reported = await reportTipTransfer(target, created.tip.tipId, txHash);
      // Reported: the service owns it now and a retry must not re-report it.
      clearHeldPayment("tip", wallet);
      return reported;
    },
    onError: (error) => {
      // No toast: the sheet is open and owns the message. A toast here would
      // put the same failure on screen twice.
      if (isRouteMissing(error)) markTippingUnavailable();
    },
    onSuccess: (tip) => {
      // Narrow on purpose. A tip changes the RECIPIENT's profile (whatever
      // totals the service decides to show there) and nothing else we cache —
      // the post's own tallies do not carry tips, so sweeping the feed would
      // refetch every timeline on screen to change nothing.
      queryClient.invalidateQueries({ queryKey: ["ms", "profile", tip.recipient.username] });
    },
  });

  return { ...mutation, unavailable };
}

export { useTippingUnavailable };
