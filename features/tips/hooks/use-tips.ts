"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorCode } from "@/lib/api/envelope";
import { isTipRouteMissing } from "@/lib/tip-errors";
import { fetchTipCapability, sendTip } from "@/features/tips/lib/api";
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

/**
 * Send one tip.
 *
 * There is NO optimistic update here, on purpose. Every other mutation in the
 * app flips a boolean the user can see and rolls it back on failure; a tip
 * moves money, and an optimistic receipt is a claim that a payment happened.
 * The receipt is rendered from the SERVER's response — its `tipId`, its
 * `amountKash`, its `status` — or it is not rendered at all.
 */
export function useSendTip() {
  const queryClient = useQueryClient();
  const unavailable = useTippingUnavailable();

  const mutation = useMutation<Tip, unknown, { target: TipTarget; amountKash: string }>({
    mutationFn: ({ target, amountKash }) => sendTip(target, amountKash),
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
