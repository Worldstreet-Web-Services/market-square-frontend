"use client";

import { usePrivy } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { embeddedEvmWallet } from "@/lib/wallet";

export interface WalletState {
  /**
   * The reader's embedded EVM wallet, or null.
   *
   * Null has three causes and every surface treats them the same way —
   * quietly. Privy has not finished loading, nobody is signed in, or the
   * reader has no embedded wallet on this Privy app. A KASH balance or a buy
   * control can do nothing useful in any of them, and inventing an address is
   * the one thing that must never happen on a money surface.
   */
  address: string | null;
  /** Privy has settled. Until then a null `address` means "not yet". */
  ready: boolean;
}

function usePrivyWallet(): WalletState {
  const { user, ready, authenticated } = usePrivy();
  if (!ready || !authenticated) return { address: null, ready };
  return { address: embeddedEvmWallet(user?.linkedAccounts), ready: true };
}

/**
 * Demo mode mounts no Privy provider, so `usePrivy()` would throw rather than
 * return nothing. The branch is taken at MODULE level for the same reason
 * `useAuth` takes it there: a conditional hook call inside the component is a
 * hooks-order violation, not a fallback.
 *
 * There is deliberately no fixture wallet. Every KASH and buy surface is
 * absent in demo mode rather than showing invented money — a balance somebody
 * could try to spend is not a thing to demo.
 */
function useDemoWallet(): WalletState {
  return { address: null, ready: true };
}

/**
 * The wallet Market Square knows the reader by.
 *
 * Market Square and the trading app share ONE Privy app id, so the embedded
 * wallet a reader has there is the same wallet here — which is the whole
 * reason a balance earned on one surface can be spent on the other. The rule
 * for picking it out of the linked accounts lives in `lib/wallet.ts`, shared
 * with the BFF that proves ownership server-side: two implementations of
 * "which wallet is yours" is how a request gets refused against its own caller.
 */
export const useEmbeddedWallet: () => WalletState = DEMO_AUTH ? useDemoWallet : usePrivyWallet;
