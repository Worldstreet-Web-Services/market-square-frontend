"use client";

import { msApi } from "@/lib/api/service";
import {
  GiftCatalogSchema,
  GiftInventorySchema,
  GiftPurchaseSchema,
  type GiftCatalogItem,
  type GiftHolding,
  type GiftPurchase,
} from "@/features/gifts/lib/types";

/**
 * The gift economy's reads and its one write.
 *
 * EVERY PATH IS WRITTEN INLINE, never assembled into a variable.
 * `pnpm check:public-routes` reads call sites statically, so a path built up
 * in a local is invisible to it — which is exactly how a route that does not
 * exist upstream reaches production as a mystery 404.
 *
 * NONE OF THESE EXIST YET. Probed against the live service on 2026-09-24:
 * `/gifts`, `/me/gifts` and `/gifts/catalog` all answer NOT_FOUND. They are
 * written here so the client is ready the day they land, and every caller is
 * built to treat their absence as a feature switch rather than an error —
 * see `useGiftInventory`.
 */

/** The service's own price table. Ours is artwork only; see the schema note. */
export async function fetchGiftCatalog(): Promise<GiftCatalogItem[]> {
  return GiftCatalogSchema.parse(await msApi.get("/gifts")).items;
}

/** What this reader owns, per gift. Own account only — there is no other read. */
export async function fetchGiftInventory(): Promise<GiftHolding[]> {
  return GiftInventorySchema.parse(await msApi.authedGet("/me/gifts")).items;
}

/**
 * Buy `quantity` of a gift with KASH.
 *
 * `idempotencyKey` is minted where the buyer's INTENT began and travels
 * unchanged through every retry — generated per request it would be a new key
 * each time and would protect nothing. The same rule `postKashPurchase`
 * already follows, and for the same reason: this charges somebody.
 *
 * The PRICE is not sent. The service holds `giftId -> priceKash` and charges
 * its own number; a client that named the amount could name the wrong one.
 */
export async function buyGift(input: {
  giftId: string;
  quantity: number;
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
