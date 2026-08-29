"use client";

import { useQuery } from "@tanstack/react-query";
import { BASE_CHAIN_ID, BASE_USDC } from "@/lib/buy-routes";
import { decodeUint256, encodeErc20BalanceOf, formatUsdc } from "@/lib/erc20";
import { publicClientForChain } from "@/lib/trade/receipt";
import { useEmbeddedWallet } from "@/hooks/use-wallet";

/**
 * What the reader can actually spend — their USDC on Base.
 *
 * Every purchase in this app is funded by one thing, so this is the number
 * that decides whether ANY of it is possible. Without it a buy sheet asks
 * somebody to pick an amount and only reveals at the payment that they hold
 * nothing, which is the same flaw the tip sheet had before it showed a KASH
 * balance: the interface knew, and made them find out the expensive way.
 *
 * Read straight off the token contract with one `eth_call`, through the
 * session-gated RPC proxy that already exists for the sponsored send path. Not
 * a portfolio service: we need exactly one balance, of one token, on one
 * chain, and the contract's own integer is the number the transfer will
 * actually be checked against — anything assembled and rounded elsewhere could
 * disagree with it at precisely the moment that matters.
 */
export interface UsdcBalance {
  /** Base units (6dp). Null means UNKNOWN — never treat it as zero. */
  units: bigint | null;
  /** Rounded DOWN to cents for display, or null while unknown. */
  formatted: string | null;
  isLoading: boolean;
}

export function useUsdcBalance(enabled = true): UsdcBalance {
  const { address } = useEmbeddedWallet();

  const query = useQuery({
    queryKey: ["usdc-balance", address],
    queryFn: async (): Promise<bigint | null> => {
      const result = await publicClientForChain(BASE_CHAIN_ID).call({
        to: BASE_USDC as `0x${string}`,
        data: encodeErc20BalanceOf(address as string),
      });
      return decodeUint256(result.data);
    },
    enabled: enabled && Boolean(address),
    // A balance moves when the reader spends, receives, or tops up somewhere
    // else entirely. Half a minute is short enough that a top-up shows up
    // while they are still looking at the sheet.
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    // A failed read is unknown, not zero, and retrying it three times per
    // sheet does not make it more known.
    retry: 1,
  });

  const units = query.data ?? null;
  return {
    units,
    formatted: units === null ? null : formatUsdc(units),
    isLoading: query.isLoading,
  };
}
