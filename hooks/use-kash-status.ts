"use client";

import { useQuery } from "@tanstack/react-query";
import { KASH_STATUS_KEY, getKashStatus } from "@/lib/kash-api";

/**
 * The KASH engine's live parameters — price, mode, and the chain it settles on.
 *
 * In `hooks/` rather than in a slice because two slices need it: the kash slice
 * to price and fund a purchase, and the tips slice to know which token a tip
 * transfers. One hook, one key, one cached answer.
 *
 * `retry: false` — a 404 is a deployment without the engine and cannot be
 * retried into existence, and a dead engine should not be asked three times by
 * every surface that mounts.
 */
export function useKashStatus() {
  return useQuery({
    queryKey: KASH_STATUS_KEY,
    queryFn: getKashStatus,
    // Engine parameters move when ops act, not by the second.
    staleTime: 60_000,
    retry: false,
  });
}
