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
