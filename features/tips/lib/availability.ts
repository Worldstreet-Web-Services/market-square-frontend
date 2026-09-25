"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the tipping service exists on this deployment.
 *
 * The Arkmark precedent (`useBookmarkPost().unavailable`) keeps this state
 * inside the mutation hook, which is right for a control that appears once per
 * card and is discovered by the person tapping it. Tipping needs it one level
 * up, because there is a tip button on EVERY post: with per-hook state, a 404
 * would quiet the one card you tapped and leave forty others still offering to
 * send money through a route that does not exist. One 404 is a fact about the
 * deployment, not about the post.
 *
 * So the answer is shared, and it is a module-level flag behind
 * `useSyncExternalStore` rather than a context or a store library (CLAUDE.md:
 * no global state manager) — the same shape `stories-row` uses for seen state.
 *
 * It is deliberately ONE-WAY: nothing sets it back to available. The route
 * either exists for this page load or it does not, and a control that
 * reappeared halfway through a session would be offering the user a coin flip.
 * A reload re-tests it, which is exactly when the deploy could have changed.
 */
let unavailable = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server snapshot: on the server nothing has been discovered yet, so tipping
 *  is assumed present and the button renders — which keeps the markup the same
 *  on both sides of hydration. */
const serverSnapshot = () => false;

export function markTippingUnavailable(): void {
  if (unavailable) return;
  unavailable = true;
  for (const listener of listeners) listener();
}

export function useTippingUnavailable(): boolean {
  return useSyncExternalStore(subscribe, () => unavailable, serverSnapshot);
}

/** Test seam only — the flag is module state and would otherwise leak between
 *  cases. Never call this from a component. */
export function resetTippingAvailability(): void {
  unavailable = false;
  for (const listener of listeners) listener();
}

/**
 * "THEY JUST LEFT" — the one gift refusal that is not the sender's fault.
 *
 * A stream gift may name anybody in the room, and the service checks that they
 * are STILL there against live presence rather than the database (a
 * `view_sessions` row is written once and left alone, because beats are
 * flushed in batches, so it would answer "here" for somebody who left minutes
 * ago — the wrong direction to be wrong in on a payment path). If they have
 * gone, nobody is paid and it answers 409 `RECIPIENT_NOT_IN_ROOM`.
 *
 * IT IS GIVEN ITS OWN CODE RATHER THAN A BARE 403 SO THE CLIENT CAN TELL TWO
 * DIFFERENT SENTENCES APART. "You may not do this" is final and the honest
 * response is to stop. "They just left" is not a refusal of the ACT at all —
 * the sender did nothing wrong, the room simply moved — and the honest
 * response is to redraw the roster and let them pick again. Collapsing the two
 * into one "couldn't send that" is how a person is made to feel they did
 * something wrong by somebody else walking out.
 *
 * Deliberately NOT a retry: re-sending to the same person would fail
 * identically, and silently retargeting the host would pay the wrong person —
 * which is the failure the recipient field exists to prevent.
 */
export const RECIPIENT_GONE = "RECIPIENT_NOT_IN_ROOM";

export function recipientLeftTheRoom(error: unknown): boolean {
  // The code is read inline rather than through `errorCode`, which lives
  // behind the `@/` alias: this module is imported directly by the node test
  // runner, which does not resolve it. It is one property access, and the
  // shape (`{ code }` on a GatewayApiError) is the same one `errorCode` reads.
  return (error as { code?: unknown } | null)?.code === RECIPIENT_GONE;
}

/**
 * A TIP THE SERVICE STILL CONSIDERS IN PROGRESS.
 *
 * One tip in flight per (target, sender, recipient), which is the guard that
 * stops a double-tap paying twice — right, and not the thing to weaken. But a
 * send that fails BEFORE the transfer is broadcast leaves that row pending
 * with no payment behind it, and nothing on the service ends that state except
 * success: there is no TTL, no sweep and no cancel. So the sender is refused
 * every further attempt at that person, forever.
 *
 * ogazboiz hit it twice in a row: *"IT DID NOT WORK I SEND COIN TO THIS PERSON
 * BUT IT DID NOT WORK THEN AFTER THAT I SAY LET ME SEND... THIS AGAIN WHAT IS
 * HAPPENING"*, staring at a raw `{"code":"CONFLICT"}` body.
 *
 * The client CANNOT resolve this on its own. `use-tips` already resumes an
 * open tip when it is holding a payment for it — but that only exists once a
 * transfer was broadcast, and here none was. The conflict carries `tipId` and
 * nothing else: no `toWallet`, no `settlement.legs`, and there is no route
 * that reads a single tip. So there is nowhere to send the money even if we
 * wanted to finish it.
 *
 * Hence this exists only to SAY SO honestly. The one thing the interface must
 * not do is imply the sender did something wrong, or that paying again would
 * help — it would not; it is refused before it reaches a wallet.
 *
 * The code is read inline for the same reason as above: `errorCode` lives
 * behind the `@/` alias, which the node test runner does not resolve.
 */
export function tipAlreadyInFlight(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "CONFLICT";
}

/**
 * THE RECIPIENT'S WALLET CANNOT HOLD KASH — a non-EVM address on an EVM rail.
 *
 * The service answered a gift with this recipient leg:
 *
 *   {"role":"recipient",
 *    "toWallet":"c8rdvzg7vkr8bd9xkletsbmozthrwktv1qfshvlxuygf",
 *    "amountKash":"0.005"}
 *
 * Forty-four characters, no `0x` — a Solana- or Tron-shaped address. KASH is
 * an ERC-20 on Base, so that address cannot receive it: a transfer encoded
 * for it would either revert or, worse, succeed into an address nobody holds
 * the key to on this chain. `lib/account-batch.ts` refuses it before signing
 * and that refusal is CORRECT — this only gives the refusal words.
 *
 * A Decane account carries `addresses.evm`, `addresses.solana` and
 * `addresses.tron`, so a profile whose stored wallet came from the wrong one
 * of those three is not an exotic case; it is a data problem that will repeat
 * until the service stores the EVM address for an EVM rail.
 *
 * Told apart from every other failure because the sender did nothing wrong
 * and retrying cannot help: the person they chose cannot be paid in this
 * currency until their account carries an EVM address.
 */
export function recipientCannotHoldKash(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /not an EVM address/u.test(message);
}
