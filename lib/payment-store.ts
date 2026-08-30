"use client";

import {
  HOLD_TTL_MS,
  parseHold,
  reusableHold,
  type PaymentHold,
} from "@/lib/payment-hold";

/**
 * Where a payment that has been MADE but not yet resolved is kept.
 *
 * Both money flows in this app have the same shape and therefore the same
 * hazard. Buying KASH is send-then-credit; buying a token is quote, send to
 * the quoted address, then wait for it to settle. In both, the transfer moves
 * real money and the step that produces something the reader can see comes
 * afterwards — so there is a window in which they have paid and have nothing.
 *
 * What a person does in that window is reload the page. wsws holds its receipt
 * in a `useRef`, which survives a failed credit but not a refresh; with the
 * receipt gone, the next attempt is a SECOND payment. So this lives in
 * `sessionStorage`: it outlives a reload and dies with the tab, because a
 * receipt found in a browser tomorrow is a stale hash rather than a rescue.
 *
 * The rules — which attempt a receipt belongs to, and how long it stays
 * reusable — are pure and live in `lib/payment-hold.ts`. This file is only the
 * storage, and every access is try/caught the way `stories-row` treats seen
 * state: Safari in private mode throws on `sessionStorage`, and a browser
 * setting must never be able to take a payment flow down.
 */

/** Which flow a hold belongs to. Two flows must never read each other's. */
/**
 * One namespace per kind of payment, so a stranded tip can never be replayed
 * as a ticket. They are stored under separate keys for that reason alone.
 */
export type PaymentNamespace = "kash" | "token" | "tip" | "ticket";

function storageKey(namespace: PaymentNamespace, wallet: string): string {
  return `ms.payment.${namespace}.${wallet.toLowerCase()}`;
}

/**
 * Record a payment that has been broadcast.
 *
 * Written BEFORE waiting for confirmation and before the step that follows it —
 * which is the whole point. Recording only successful payments would record
 * exactly the ones that never needed rescuing.
 */
export function holdPayment(
  namespace: PaymentNamespace,
  wallet: string,
  hold: Omit<PaymentHold, "createdAt">
): void {
  try {
    sessionStorage.setItem(
      storageKey(namespace, wallet),
      JSON.stringify({ ...hold, createdAt: Date.now() })
    );
  } catch {
    // No storage available. The in-page retry still works; a reload loses the
    // receipt, which is the behaviour this improves on rather than a
    // regression from it.
  }
}

/** The payment this attempt has already made, or null. */
export function heldPayment(
  namespace: PaymentNamespace,
  wallet: string,
  key: string | null
): PaymentHold | null {
  try {
    const raw = sessionStorage.getItem(storageKey(namespace, wallet));
    if (!raw) return null;
    return reusableHold(parseHold(JSON.parse(raw)), key, Date.now(), HOLD_TTL_MS);
  } catch {
    return null;
  }
}

/**
 * Forget the receipt — its outcome is known and it must never be reused.
 *
 * Called when the flow completes, AND when the service says the payment has
 * already been settled: that conflict is proof it was credited, and keeping a
 * hash the service has already consumed is how a later purchase gets answered
 * with "already done" and delivers nothing.
 */
export function clearHeldPayment(namespace: PaymentNamespace, wallet: string): void {
  try {
    sessionStorage.removeItem(storageKey(namespace, wallet));
  } catch {
    // Nothing to do. The TTL in `lib/payment-hold.ts` is the backstop.
  }
}
