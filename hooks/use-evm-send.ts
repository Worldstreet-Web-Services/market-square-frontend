"use client";

import { useCallback } from "react";
import { useSendTransaction, useSignTypedData, useWallets } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { MARKET_FLAGS } from "@/lib/market-config";
import { isSettledOutcome, receiptOutcome, type TxOutcome } from "@/lib/tx-receipt";

/**
 * The ONE path by which anything leaves a reader's wallet.
 *
 * Every payment in Market Square — the USDC that funds a `$TICKER` buy, the
 * USDC that buys KASH — is signed here, by the reader, from their own embedded
 * wallet. The platform never holds their keys and never spends on their behalf
 * (ADR-0005, and `docs/PAYING_WITH_KASH.md`), so there is exactly one send and
 * it is this.
 *
 * ── GAS ────────────────────────────────────────────────────────────────────
 * A send on Base costs gas, paid in ETH from the sending wallet. wsws covers
 * that with its own sponsorship stack (an Alchemy gas policy behind a 7702
 * bundler proxy); Market Square has neither the policy nor the proxy, so it
 * uses Privy's own sponsorship instead — one boolean, configured on the Privy
 * dashboard rather than in this repo.
 *
 * It is behind a flag because asking for sponsorship an app has not been
 * granted is an error, not a fallback, and because it is the kind of thing
 * that must be verified on the dashboard before it is switched on here.
 * **Unsponsored, a reader whose embedded wallet holds only USDC cannot pay
 * gas and the send fails.** That failure is honest and legible — the wallet
 * says so — but it is a real gap, not a graceful degradation.
 */
export interface EvmSendInput {
  to: `0x${string}`;
  data?: `0x${string}`;
  /** Native value in wei. Sponsorship covers gas only; this is still theirs. */
  value?: bigint;
  chainId: number;
}

/** How long to wait for a payment to be mined before giving up on watching it. */
const RECEIPT_TIMEOUT_MS = 90_000;
const RECEIPT_POLL_MS = 2_000;

export interface EvmSend {
  /** Signs and submits. Resolves with the hash once the node accepts it. */
  send: (input: EvmSendInput) => Promise<`0x${string}`>;
  /**
   * Waits for the transaction to be MINED and reports what it did.
   *
   * Separate from `send` on purpose. The hash is what must be held for a
   * retry the moment it exists (see `lib/payment-hold.ts`) — if waiting were
   * folded into the send, a timeout while waiting would throw away the hash of
   * a payment that had already left the wallet, which is the exact
   * double-charge this whole flow is built to avoid.
   *
   * Answers `pending` on a timeout rather than throwing: the transaction is
   * not lost, we merely stopped watching, and the caller still holds the hash.
   */
  waitForReceipt: (hash: `0x${string}`) => Promise<TxOutcome>;
  /** Signs an EIP-712 payload the backend built. Gasless — a prompt, not a send. */
  signTypedData: (owner: string, typedData: Record<string, unknown>) => Promise<string>;
}

function usePrivyEvmSend(): EvmSend {
  const { sendTransaction } = useSendTransaction();
  const { signTypedData: privySignTypedData } = useSignTypedData();
  const { wallets } = useWallets();

  /** The embedded wallet, which is the only one this app ever sends from. */
  const embedded = useCallback(
    () => wallets.find((wallet) => wallet.walletClientType === "privy") ?? null,
    [wallets]
  );

  const send = useCallback(
    async ({ to, data, value, chainId }: EvmSendInput): Promise<`0x${string}`> => {
      const wallet = embedded();
      if (!wallet) throw new Error("No wallet is connected.");
      const { hash } = await sendTransaction(
        {
          to,
          data,
          // Privy's request type takes a quantity; a bigint would be serialised
          // by whatever happens to touch it first, and `0.1e18` is not a value.
          ...(value === undefined ? {} : { value: `0x${value.toString(16)}` }),
          chainId,
        },
        {
          address: wallet.address,
          ...(MARKET_FLAGS.sponsoredGas ? { sponsor: true } : {}),
        }
      );
      return hash;
    },
    [embedded, sendTransaction]
  );

  const waitForReceipt = useCallback(
    async (hash: `0x${string}`): Promise<TxOutcome> => {
      const wallet = embedded();
      if (!wallet) return "pending";
      /**
       * Asked through the WALLET's own provider rather than an RPC URL of our
       * own. Two reasons: there is no Base RPC in this app's configuration and
       * inventing one would be exactly the guess this work is not allowed to
       * make, and the wallet's provider is by definition pointed at the chain
       * the transaction was just sent on.
       */
      const provider = await wallet.getEthereumProvider();
      const deadline = Date.now() + RECEIPT_TIMEOUT_MS;
      for (;;) {
        let outcome: TxOutcome = "pending";
        try {
          const receipt = await provider.request({
            method: "eth_getTransactionReceipt",
            params: [hash],
          });
          outcome = receiptOutcome(receipt as { status?: unknown } | null);
        } catch {
          // A provider hiccup is not an answer about the payment. Keep waiting.
        }
        if (isSettledOutcome(outcome)) return outcome;
        if (Date.now() >= deadline) return "pending";
        await new Promise((resolve) => setTimeout(resolve, RECEIPT_POLL_MS));
      }
    },
    [embedded]
  );

  const signTypedData = useCallback(
    async (owner: string, typedData: Record<string, unknown>): Promise<string> => {
      const { signature } = await privySignTypedData(
        typedData as Parameters<typeof privySignTypedData>[0],
        { address: owner }
      );
      return signature;
    },
    [privySignTypedData]
  );

  return { send, waitForReceipt, signTypedData };
}

/**
 * Demo mode mounts no Privy provider, so the hooks above would throw on render
 * rather than return nothing. Branching at MODULE level is the same shape
 * `useAuth` and `useEmbeddedWallet` use, and for the same reason: a conditional
 * hook call is a hooks-order violation, not a fallback.
 *
 * The functions REJECT rather than resolving with a fake hash. A demo that
 * hands back a plausible-looking transaction id would let every downstream step
 * report success on a payment that never existed, which is the one lie this
 * whole flow is built to make impossible.
 */
function useDemoEvmSend(): EvmSend {
  const refuse = useCallback(async (): Promise<never> => {
    throw new Error("There's no wallet in demo mode.");
  }, []);
  const pending = useCallback(async (): Promise<TxOutcome> => "pending", []);
  return { send: refuse, waitForReceipt: pending, signTypedData: refuse };
}

export const useEvmSend: () => EvmSend = DEMO_AUTH ? useDemoEvmSend : usePrivyEvmSend;
