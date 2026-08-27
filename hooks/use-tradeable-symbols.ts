"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Symbols a `$TICKER` may link to.
 *
 * One query for the whole app: every post card would otherwise ask, and the
 * answer is identical for all of them. Long-lived because a listing catalogue
 * changes on the order of days, not seconds.
 *
 * Failure yields an empty list rather than an error state. Nothing here is
 * worth telling a reader about: they lose a chip, not a post.
 */
export function useTradeableSymbols(): string[] {
  const query = useQuery({
    queryKey: ["ms", "tradeable-symbols"],
    queryFn: async (): Promise<string[]> => {
      const res = await fetch("/api/symbols");
      if (!res.ok) return [];
      const body = (await res.json()) as { symbols?: string[] };
      return body.symbols ?? [];
    },
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });
  return query.data ?? [];
}
