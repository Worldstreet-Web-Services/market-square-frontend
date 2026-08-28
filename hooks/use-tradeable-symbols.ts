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
export interface TradeableMarket {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  logo: string | null;
}

interface Catalogue {
  symbols: string[];
  markets: TradeableMarket[];
}

/**
 * The catalogue, with prices.
 *
 * `staleTime` is a MINUTE now, not thirty. It used to carry symbol names,
 * which change on the order of days; it carries prices, which do not. A
 * half-hour-old price shown confidently is worse than no price.
 */
function useCatalogue() {
  return useQuery({
    queryKey: ["ms", "tradeable-catalogue"],
    queryFn: async (): Promise<Catalogue> => {
      const res = await fetch("/api/symbols");
      if (!res.ok) return { symbols: [], markets: [] };
      const body = (await res.json()) as Partial<Catalogue>;
      return { symbols: body.symbols ?? [], markets: body.markets ?? [] };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}

export function useTradeableSymbols(): string[] {
  return useCatalogue().data?.symbols ?? [];
}

/** Priced entries only. A symbol with no price renders no chip. */
export function useTradeableMarkets(): Map<string, TradeableMarket> {
  const markets = useCatalogue().data?.markets ?? [];
  return new Map(markets.map((market) => [market.symbol.toUpperCase(), market]));
}
