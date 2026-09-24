"use client";

import { msApi } from "@/lib/api/service";
import {
  CoinBalanceSchema,
  GiftCapabilitySchema,
  GiftCatalogSchema,
  GiftInventorySchema,
  GiftPurchaseSchema,
  InsufficientCoinsSchema,
  type GiftCapability,
  type GiftCatalogItem,
  type GiftHolding,
  type GiftPurchase,
  type InsufficientCoins,
} from "@/features/gifts/lib/types";

/**
 * The gift economy's reads and its one write.
 *
 * EVERY PATH IS WRITTEN INLINE, never assembled into a variable.
 * `pnpm check:public-routes` reads call sites statically, so a path built up
 * in a local is invisible to it — which is exactly how a route that does not
 * exist upstream reaches production as a mystery 404.
 *
 * NONE OF THESE EXIST IN PRODUCTION YET — `/gifts`, `/me/coins` and
 * `/me/gifts` all answer NOT_FOUND, and every caller treats that absence as a
 * feature switch rather than an error (see `useGiftInventory`).
 *
 * BUT THE SHAPES ARE NO LONGER GUESSES. They were written against a described
 * contract and every single read was keyed wrong: `items` where the service
 * answers `gifts`, `balance` where it answers `coins`, `owned` where it
 * answers `balance`. Because each schema is tolerant, none of that would have
 * thrown — it would have shipped as an empty tray and a zero balance with a
 * clean console, on a day nobody was looking at this file.
 *
 * Every path and every key below is now read off the service's own controller
 * (`gift-controller.ts`, `gift-service.ts`) at `1399a253`, which is pushed and
 * unmerged. Verified in the source, not taken from a description of it.
 */

/**
 * The service's own price table. Ours is artwork only; see the schema note.
 *
 * PUBLIC, deliberately: a price list is not somebody's private business, and a
 * tray has to draw before anybody has signed in.
 */
export async function fetchGiftCatalog(): Promise<GiftCatalogItem[]> {
  return GiftCatalogSchema.parse(await msApi.get("/gifts")).gifts;
}

/**
 * Whether coins can be bought here, the rate, and the ladder — one read.
 *
 * Separate from the catalogue because it answers a different question: the
 * catalogue is what things COST, this is whether the economy is switched on at
 * all and what a coin is worth. Also public.
 */
export async function fetchGiftCapability(): Promise<GiftCapability> {
  return GiftCapabilitySchema.parse(await msApi.get("/gifts/capability"));
}

/** How many coins this reader holds. Own account only. */
export async function fetchCoinBalance(): Promise<number> {
  return CoinBalanceSchema.parse(await msApi.authedGet("/me/coins")).coins;
}

/** What this reader owns, per gift. Own account only — there is no other read. */
export async function fetchGiftInventory(): Promise<GiftHolding[]> {
  return GiftInventorySchema.parse(await msApi.authedGet("/me/gifts")).gifts;
}

/**
 * Buy `quantity` of a gift with KASH.
 *
 * `idempotencyKey` is minted where the buyer's INTENT began and travels
 * unchanged through every retry — generated per request it would be a new key
 * each time and would protect nothing. The same rule `postKashPurchase`
 * already follows, and for the same reason: this charges somebody.
 *
 * The PRICE is not sent. The service holds `giftId -> priceCoins` and charges
 * its own number; a client that named the amount could name the wrong one.
 *
 * SETTLES IMMEDIATELY — 200, never 201-and-wait. No money moves here: the KASH
 * was paid when the COINS were bought. A client that put a pending state on
 * this would show a spinner over an action that is already finished, and one
 * that put an instant state on the COIN purchase would tell somebody their
 * coins had arrived before anybody paid for them. The two buys are shaped
 * differently on purpose and must not share a component.
 */
export async function buyGift(input: {
  giftId: string;
  quantity: number;
  /** REQUIRED by the service — 400 without it. See the note above. */
  idempotencyKey: string;
}): Promise<GiftPurchase> {
  return GiftPurchaseSchema.parse(
    await msApi.post(
      "/me/gifts",
      { giftId: input.giftId, quantity: input.quantity },
      { "Idempotency-Key": input.idempotencyKey }
    )
  );
}

/**
 * THE NUMBERS INSIDE A "NOT ENOUGH COINS" REFUSAL, when it carries them.
 *
 * `null` when this is some other failure, or when the body is not the shape we
 * expect — an error that cannot be parsed is still an error, and a top-up
 * offer is a nicety on top of a refusal rather than a condition of showing
 * one. Callers fall back to the plain message.
 */
export function insufficientCoins(error: unknown): InsufficientCoins | null {
  const details = (error as { details?: unknown } | null)?.details;
  const parsed = InsufficientCoinsSchema.safeParse(details);
  return parsed.success ? parsed.data : null;
}
