"use client";

import { useSyncExternalStore } from "react";

// Query params never change without a navigation, which remounts the tree.
const subscribe = () => () => {};

/**
 * Reads a URL query parameter without a Suspense boundary.
 *
 * `useSearchParams` forces one at the route, and that boundary delays
 * hydration of the subtree — long enough for user queries to resolve first,
 * which makes the first client render disagree with the served HTML. The
 * server snapshot here is `null`, so both sides start identical and the real
 * value arrives on the pass straight after hydration.
 */
export function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null
  );
}
