import { z } from "zod";

/**
 * The KASH engine's contract, as Market Square reads it.
 *
 * Every amount on this wire is a DECIMAL STRING and stays one. The engine
 * rejects JSON numbers outright, and a float cannot carry money — so nothing
 * here is `z.coerce.number()`, and nothing downstream does arithmetic on these
 * values that is not string or `BigInt` work (`lib/kash-amount.ts`,
 * `lib/erc20.ts`).
 *
 * The schemas are NARROW on purpose: only the fields a Market Square surface
 * actually reads. Unknown keys are stripped rather than rejected, so the
 * engine can grow fields — points tiers, subscription tiers, the sell desk —
 * without blanking a balance line here. What is not read is not parsed, which
 * also means this file is an honest list of what this app depends on.
 */

/**
 * The engine's status schema lives in `lib/kash-api.ts`, not here.
 *
 * Tipping needs the chain configuration too — a tip is a KSH transfer the
 * sender signs — and slices never import each other. Re-exported so this
 * slice's own modules keep one import path.
 */
export { KashStatusSchema, type KashStatus } from "@/lib/kash-api";

/**
 * `GET /accounts/:wallet` — the wallet-scoped read.
 *
 * `balance` is settled KSH the wallet actually holds; `week.points` is
 * unconverted activity credit that becomes KSH at the weekly settlement.
 * They are DIFFERENT NUMBERS and the UI must never add or conflate them —
 * points are not spendable, and showing them as a balance would offer somebody
 * money they cannot send.
 */
export const KashAccountSchema = z.object({
  wallet: z.string(),
  balance: z.string(),
  balanceUsd: z.string(),
  week: z
    .object({
      points: z.string().optional(),
      unclaimed: z.string().optional(),
      settlesAt: z.string().optional(),
    })
    .optional(),
});

export type KashAccount = z.infer<typeof KashAccountSchema>;

/** `GET /purchases/quote?amount=` — what a dollar amount buys, fee included. */
export const KashPurchaseQuoteSchema = z.object({
  usdcAmount: z.string(),
  kashReceived: z.string(),
  kashPriceUsd: z.string(),
  /**
   * The fee is taken off the top BEFORE any KASH is priced, so it is charged
   * whether or not it is displayed. Showing it is what stops "you receive"
   * looking like a bad rate.
   */
  feeUsd: z.string().optional(),
  feePct: z.number().optional(),
});

export type KashPurchaseQuote = z.infer<typeof KashPurchaseQuoteSchema>;

/** `POST /purchases` — the credited purchase, in the engine's own numbers. */
export const KashPurchaseSchema = z.object({
  id: z.string(),
  usdcPaid: z.string(),
  kashReceived: z.string(),
  kashPriceUsd: z.string().optional(),
  mintTxHash: z.string().optional(),
  paymentTxHash: z.string().optional(),
});

export type KashPurchase = z.infer<typeof KashPurchaseSchema>;

/**
 * `GET /desk` — the on-chain sale desk.
 *
 * When this answers, it SUPERSEDES the two-step purchase flow: one permit
 * signature and one transaction, in which USDC leaves the wallet and freshly
 * minted KASH arrives atomically. A 404 or 503 means no desk is configured and
 * the two-step flow applies; `paused.sale` means a desk exists and has been
 * deliberately stopped, which is a halt rather than a reason to fall back.
 */
export const KashDeskInfoSchema = z.object({
  chainId: z.number(),
  priceUsd: z.string().optional(),
  paused: z.object({ sale: z.boolean().catch(false) }).optional(),
});

export type KashDeskInfo = z.infer<typeof KashDeskInfoSchema>;

export const KashDeskBuyQuoteSchema = z.object({
  usdcIn: z.string(),
  kashOut: z.string(),
  paused: z.boolean().optional(),
});

export type KashDeskBuyQuote = z.infer<typeof KashDeskBuyQuoteSchema>;

/**
 * `POST /desk/buy/prepare` — the EIP-712 payload to sign.
 *
 * It arrives COMPLETE: domain, nonce, deadline, spender, value. The client
 * signs it and nothing more. That is deliberate — the permit-domain subtleties
 * (USDC signs as "USD Coin"/"2"; the KASH token as "Kash"/"1") are exactly the
 * kind of detail a second implementation gets wrong, and a wrong domain means
 * a signature that reverts after the user has already approved it.
 */
export const KashDeskPreparedSchema = z.object({
  deadline: z.number(),
  typedData: z.object({
    domain: z.record(z.string(), z.unknown()),
    types: z.record(z.string(), z.unknown()),
    primaryType: z.string(),
    message: z.record(z.string(), z.unknown()),
  }),
  quote: z.record(z.string(), z.string()).optional(),
});

export type KashDeskPrepared = z.infer<typeof KashDeskPreparedSchema>;

/** `POST /desk/buy/tx` — the encoded transaction the wallet submits. */
export const KashDeskTxSchema = z.object({
  chainId: z.number(),
  to: z.string(),
  data: z.string(),
  value: z.string().optional(),
});

export type KashDeskTx = z.infer<typeof KashDeskTxSchema>;
