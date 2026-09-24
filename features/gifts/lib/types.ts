import { z } from "zod";

/**
 * THE GIFT ECONOMY'S CONTRACT — buy gifts, hold them, spend them in a room.
 *
 * ogazboiz, 2026-09-24: "just like tiktok gift system — they can buy and hold
 * them and when they are in the gist room they can send it to someone, and
 * again and buy kash". So a gift is an OBJECT you own, not a payment you make
 * at the moment of sending.
 *
 * ─── WHY THE SERVICE MUST OWN THE PRICE ──────────────────────────────────────
 * `LIVE_GIFTS` in `lib/gifts.ts` is OURS, and that is correct only while a
 * gift is a LABEL and the sender names their own amount. The moment a gift id
 * SELECTS a price, the client naming both is a forgery waiting to happen: a
 * modified client posts `giftId: "bank"` with a penny and the room sees the
 * most expensive animation in the tray.
 *
 * So the catalogue below is the SERVICE's. The client keeps the ARTWORK —
 * artwork must never come off the wire, because the sender is another browser
 * whose build may be ahead of this one — and the service keeps the money.
 */
export const GiftCatalogItemSchema = z.object({
  /** Matches an id in `LIVE_GIFTS`; an id we do not know draws nothing. */
  id: z.string(),
  name: z.string(),
  /** A DECIMAL STRING, never a number. See `TipSchema` for why money is text. */
  priceKash: z.string(),
});
export type GiftCatalogItem = z.infer<typeof GiftCatalogItemSchema>;

export const GiftCatalogSchema = z.object({
  items: z.array(GiftCatalogItemSchema).catch([]),
});

/**
 * HOW MANY OF EACH GIFT THIS READER OWNS.
 *
 * `quantity` is what the gallery tile prints and what the room tray spends
 * from. Zero is a REAL ANSWER here and is drawn — "you own none" is a fact
 * with an action attached, which is the whole reason the tile carries a `+`.
 * That is the opposite of the rule the gallery follows for gifts RECEIVED,
 * where a blank is honest because nobody-sent-you-one is closer to unknown.
 */
export const GiftHoldingSchema = z.object({
  giftId: z.string(),
  quantity: z.number(),
});
export type GiftHolding = z.infer<typeof GiftHoldingSchema>;

export const GiftInventorySchema = z.object({
  items: z.array(GiftHoldingSchema).catch([]),
});

/**
 * WHAT A PURCHASE ANSWERS.
 *
 * The NEW quantity is read back from the server rather than incremented here:
 * a client that adds its own count would drift from the ledger the first time
 * two devices bought at once, and this is somebody's money.
 */
export const GiftPurchaseSchema = z.object({
  giftId: z.string(),
  quantity: z.number(),
  /** The holding AFTER this purchase, as the service computed it. */
  owned: z.number().optional(),
});
export type GiftPurchase = z.infer<typeof GiftPurchaseSchema>;

/**
 * SQUARE COINS — the unit gifts are priced in.
 *
 * An INTEGER, deliberately. A coin is the smallest spendable thing, so a
 * fractional one cannot exist, and using a whole number here means the tray's
 * arithmetic is exact by construction rather than by careful string handling.
 * That is the quiet benefit of the unit: three Roses is 30, not
 * 0.030000000000000002.
 */
export const CoinBalanceSchema = z.object({
  balance: z.number(),
});
