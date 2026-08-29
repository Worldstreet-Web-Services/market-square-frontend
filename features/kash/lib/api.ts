"use client";

import { createServiceClient } from "@/lib/api/service";
import {
  KashAccountSchema,
  KashDeskBuyQuoteSchema,
  KashDeskInfoSchema,
  KashDeskPreparedSchema,
  KashDeskTxSchema,
  KashPurchaseQuoteSchema,
  KashPurchaseSchema,
  KashStatusSchema,
  type KashAccount,
  type KashDeskBuyQuote,
  type KashDeskInfo,
  type KashDeskPrepared,
  type KashDeskTx,
  type KashPurchase,
  type KashPurchaseQuote,
  type KashStatus,
} from "@/features/kash/lib/types";

/**
 * The KASH transport.
 *
 * Its own client rather than `msApi`, because it is its own upstream behind its
 * own proxy (`app/api/kash/[...path]`), and — the part that matters — because
 * `breaker: false` keeps its failures out of Market Square's shared circuit
 * breaker. The engine is not running in every environment; three 502s from a
 * balance poll must not open the breaker and tell the feed, messages and
 * notifications that the square is down.
 */
const kashApi = createServiceClient("/api/kash", {
  fallbackMessage: "KASH is unavailable right now.",
  breaker: false,
});

/** Public. Every live parameter, including the addresses a purchase pays to. */
export async function getKashStatus(): Promise<KashStatus> {
  return KashStatusSchema.parse(await kashApi.get("/status"));
}

/**
 * Wallet-scoped. The BFF proves this wallet is the caller's own before the
 * request ever reaches the engine — see `app/api/kash/[...path]/route.ts`.
 */
export async function getKashAccount(wallet: string): Promise<KashAccount> {
  return KashAccountSchema.parse(await kashApi.authedGet(`/accounts/${wallet}`));
}

/** Public. What a dollar amount buys at the current price, fee included. */
export async function getKashPurchaseQuote(usdcAmount: string): Promise<KashPurchaseQuote> {
  return KashPurchaseQuoteSchema.parse(
    await kashApi.get("/purchases/quote", { amount: usdcAmount })
  );
}

/**
 * Credit a USDC payment the buyer has ALREADY made.
 *
 * `paymentTxHash` is the payment; this call is only the credit. The two are
 * separate steps and only the first moves money, which is why the hash is held
 * outside the call stack and reused on every retry of the same attempt
 * (`lib/payment-hold.ts`). The engine refuses to settle one hash twice —
 * `payment_already_used` comes back as a CONFLICT — so a retry can at worst be
 * told the credit already happened, never charge again.
 *
 * `idempotencyKey` is minted where the buyer's intent began and travels
 * unchanged through every retry. Generated per request it would be a new key
 * each time and would protect nothing.
 */
export async function postKashPurchase(input: {
  wallet: string;
  usdcAmount: string;
  paymentTxHash?: string;
  idempotencyKey: string;
}): Promise<KashPurchase> {
  return KashPurchaseSchema.parse(
    await kashApi.post(
      "/purchases",
      {
        wallet: input.wallet,
        usdcAmount: input.usdcAmount,
        ...(input.paymentTxHash ? { paymentTxHash: input.paymentTxHash } : {}),
      },
      { "Idempotency-Key": input.idempotencyKey }
    )
  );
}

/** Public. Answers only where an on-chain sale desk is configured. */
export async function getKashDeskInfo(): Promise<KashDeskInfo> {
  return KashDeskInfoSchema.parse(await kashApi.get("/desk"));
}

export async function getKashDeskBuyQuote(usdcAmount: string): Promise<KashDeskBuyQuote> {
  return KashDeskBuyQuoteSchema.parse(await kashApi.get("/desk/buy/quote", { usdcAmount }));
}

export async function postKashDeskPrepareBuy(
  wallet: string,
  usdcAmount: string
): Promise<KashDeskPrepared> {
  return KashDeskPreparedSchema.parse(
    await kashApi.post("/desk/buy/prepare", { wallet, usdcAmount })
  );
}

export async function postKashDeskBuyTx(input: {
  wallet: string;
  usdcAmount: string;
  deadline: number;
  signature: string;
  idempotencyKey: string;
}): Promise<KashDeskTx> {
  return KashDeskTxSchema.parse(
    await kashApi.post(
      "/desk/buy/tx",
      {
        wallet: input.wallet,
        usdcAmount: input.usdcAmount,
        deadline: input.deadline,
        signature: input.signature,
      },
      { "Idempotency-Key": input.idempotencyKey }
    )
  );
}

/**
 * The signing payload, with the `EIP712Domain` type entry providers insist on.
 *
 * `eth_signTypedData_v4` validates that `types` describes the domain as well as
 * the message; the backend keeps its payload minimal and sends only the struct
 * being signed. The four domain fields are the standard ones in their canonical
 * order, matching the domain object the backend already built — this adds the
 * DESCRIPTION of the domain, never the domain itself, which stays the server's.
 */
export function withDomainType(typedData: KashDeskPrepared["typedData"]) {
  if (typedData.types.EIP712Domain) return typedData;
  return {
    ...typedData,
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ...typedData.types,
    },
  };
}
