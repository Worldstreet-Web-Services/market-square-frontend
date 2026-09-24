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
  /**
   * WHAT THE TRAY CHARGES, IN SQUARE COINS — a whole number, always.
   *
   * Coins are what people see and spend; KASH is what they buy coins WITH and
   * what a recipient earns. An integer because a coin is the smallest thing
   * there is, which is what makes the tray's arithmetic exact rather than
   * carefully rounded: three Roses is 30, not 0.030000000000000002.
   */
  priceCoins: z.number(),
  /** A DECIMAL STRING, never a number. See `TipSchema` for why money is text. */
  priceKash: z.string(),
});
export type GiftCatalogItem = z.infer<typeof GiftCatalogItemSchema>;

/**
 * `GET /gifts` — the envelope's key is `gifts`, not `items`.
 *
 * READ OFF THE SERVICE RATHER THAN AGREED IN PROSE. This slice was written
 * against a described shape and every read was keyed wrong — `items` where the
 * controller answers `gifts`, `balance` where it answers `coins`. Each one
 * parses to an empty list rather than throwing, so the failure on the day the
 * routes shipped would have been an empty tray and a zero balance with nothing
 * in the console. Verified against `gift-controller.ts` at `1399a253`.
 */
export const GiftCatalogSchema = z.object({
  gifts: z.array(GiftCatalogItemSchema).catch([]),
});

/**
 * `GET /gifts/capability` — whether this deployment sells coins, and at what.
 *
 * `coinsPerKash` IS READ, NEVER ASSUMED. The rate exists in two repositories
 * and a constant copied into both is a constant that can be changed in one;
 * the service publishes it so a reprice is one deploy rather than two that
 * have to land together. `lib/gifts.ts` keeps its own `COINS_PER_KASH` only to
 * price the tray BEFORE this route answers — the catalogue's own `priceCoins`
 * wins the moment it does.
 *
 * `purchasable: false` means no treasury is configured and coins cannot be
 * bought here at all — a real state to draw, not an error.
 */
export const GiftCapabilitySchema = z.object({
  purchasable: z.boolean(),
  coinsPerKash: z.number(),
  gifts: z.array(GiftCatalogItemSchema).catch([]),
});
export type GiftCapability = z.infer<typeof GiftCapabilitySchema>;

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
  gifts: z.array(GiftHoldingSchema).catch([]),
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
  /**
   * THE COIN BALANCE AFTER THIS PURCHASE, which is why nothing re-reads.
   *
   * The service answers with the new stock AND the new balance precisely so a
   * client never has to ask again to redraw. It is also the reason this buy
   * has no pending state: no money moves here — the KASH was paid when the
   * COINS were bought — so the response is the final answer, not a receipt for
   * something still settling.
   */
  balance: z.number(),
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
  coins: z.number(),
});

/**
 * 409 `INSUFFICIENT_COINS`, and it CARRIES THE NUMBERS.
 *
 * `{ needed, balance }`, so a shortfall can be offered as the exact top-up
 * rather than a refusal and a guess. Same instinct as the KASH path, which
 * already offers the difference instead of saying no.
 *
 * Tolerant because it is an ERROR body: a refusal that cannot be parsed must
 * still be a refusal, so a caller that cannot read the numbers falls back to
 * the plain message rather than throwing inside a failure path.
 */
export const InsufficientCoinsSchema = z.object({
  needed: z.number(),
  balance: z.number(),
});
export type InsufficientCoins = z.infer<typeof InsufficientCoinsSchema>;
