import { MARKET_FLAGS } from "./market-config.ts";
import { asset } from "./square-path.ts";
/**
 * The gift catalogue — one list, used by both places KASH changes hands.
 *
 * It lives in `lib/` rather than either slice because the live room (streams)
 * and the post tip sheet (tips) both render it, and slices never import each
 * other. Pure data, so the ladder can be pinned by a test without a renderer.
 *
 * ARTWORK is the design file's: fourteen rendered objects, exported and
 * cropped from the source rather than redrawn or stood in for by emoji.
 *
 * PRICES are ours. Every tile in the file is drawn priced "20", which is a
 * placeholder rather than a price list, so the ladder is ordered by what the
 * object means: a rose is the smallest thing you can say, the KASH coin the
 * largest. It is deliberately a SUPERSET of `TIP_PRESETS_KASH` — every rung
 * there is a gift price here — so a "10" means the same thing whether it
 * arrives as a gift or as a typed amount.
 *
 * THE LADDER IS DENOMINATED IN A $7 TOKEN, which is the thing to hold on to
 * when changing it. It was first written as though KASH were a cheap point:
 * the rose cost 1 KASH and the coin 1000, which at the engine's own price is
 * $7 and $7,000. That put the CHEAPEST gift in the room at 560x TikTok's rose
 * (1.25c) and the dearest at 16x the most expensive gift TikTok has ever sold
 * (~$437) — and it made the tray unusable for exactly the people it is for: a
 * wallet holding $1.71 could not send a single rose.
 *
 * So the rungs are now sub-unit. `MAX_TIP_DECIMALS` is 2, so 0.01 KASH — 7
 * cents — is the smallest amount that exists; the ladder starts there and
 * climbs to 50 KASH ($350), landing the whole tray inside the range people
 * actually spend. Anything below two decimal places is rejected as
 * too-precise before it reaches the wire, so do not add a rung the client
 * cannot express.
 *
 * When the KASH price moves, these numbers mean something different. They are
 * a product decision, not a constant — revisit them rather than assuming the
 * dollar figures in this comment still hold.
 */
export interface LiveGift {
  id: string;
  name: string;
  art: string;
  /**
   * WHAT A GIFT COSTS, and the unit a reader actually sees.
   *
   * Gifts are bought with SQUARE COINS, not with KASH directly (ogazboiz,
   * 2026-09-24: "we use the kash to buy square coin and in the gift it is
   * square coin prize they will show"). Three layers, TikTok's exactly:
   *
   *   KASH  -> buy COINS       the spending unit; every tile is priced in it
   *   COINS -> buy GIFTS       into a stock you hold, which the gallery counts
   *   GIFT sent -> the recipient earns KASH
   *
   * A coin exists so the numbers on a tile read like prices instead of like
   * fractions: "10" rather than "0.01". Nothing got cheaper or dearer — the
   * rate is chosen so every rung keeps the dollar value it already had.
   */
  priceCoins: number;
  /**
   * The same rung in KASH, kept because it is what the money actually settles
   * in and what `POST /streams/:id/gifts` has always spoken. It is NOT drawn
   * any more; `priceCoins` is the number on screen.
   */
  priceKash: string;
}

/**
 * 1 KASH = 1000 COINS, and at the desk's verified $7 that puts a coin at
 * 0.7 cents.
 *
 * Every rung below is exactly `priceKash x COINS_PER_KASH`, which is not a
 * coincidence and is pinned by a test: the coin ladder was derived from the
 * KASH one precisely so that switching the displayed unit changes what a
 * reader SEES and nothing about what anything COSTS. If the two ever disagree
 * the tile is lying about one of them.
 */
export const COINS_PER_KASH = 1000;

/**
 * The tray, cheapest first — the order the file draws them in is the order
 * they read in, and price is what makes that order mean something.
 */
export const LIVE_GIFTS: LiveGift[] = [
  // Dollar figures are at the engine's kashPriceUsd of $7 — see the note above.
  { id: "rose", name: "Rose", art: asset("/gifts/gift-13.png"), priceCoins: 10, priceKash: "0.01" }, //  $0.07
  { id: "heart", name: "Heart", art: asset("/gifts/gift-06.png"), priceCoins: 20, priceKash: "0.02" }, // $0.14
  { id: "book", name: "Book", art: asset("/gifts/gift-03.png"), priceCoins: 50, priceKash: "0.05" }, //  $0.35
  { id: "dove", name: "Dove", art: asset("/gifts/gift-02.png"), priceCoins: 100, priceKash: "0.1" }, //   $0.70
  { id: "boots", name: "Boots", art: asset("/gifts/gift-10.png"), priceCoins: 150, priceKash: "0.15" }, // $1.05
  { id: "jacket", name: "Jacket", art: asset("/gifts/gift-08.png"), priceCoins: 200, priceKash: "0.2" }, // $1.40
  { id: "phone", name: "Phone", art: asset("/gifts/gift-09.png"), priceCoins: 250, priceKash: "0.25" }, // $1.75
  { id: "router", name: "Router", art: asset("/gifts/gift-05.png"), priceCoins: 500, priceKash: "0.5" }, // $3.50
  { id: "lion", name: "Lion", art: asset("/gifts/gift-01.png"), priceCoins: 1000, priceKash: "1" }, //      $7
  { id: "bull", name: "Bull", art: asset("/gifts/gift-12.png"), priceCoins: 2000, priceKash: "2" }, //     $14
  { id: "bank", name: "Bank", art: asset("/gifts/gift-11.png"), priceCoins: 5000, priceKash: "5" }, //     $35
  { id: "phoenix", name: "Phoenix", art: asset("/gifts/gift-04.png"), priceCoins: 10000, priceKash: "10" }, // $70
  { id: "car", name: "Car", art: asset("/gifts/gift-07.png"), priceCoins: 25000, priceKash: "25" }, //     $175
  { id: "kash", name: "KASH coin", art: asset("/gifts/gift-14.png"), priceCoins: 50000, priceKash: "50" }, // $350
];

/**
 * Is the tray charging for gifts in this room?
 *
 * ONE rule, in one place, because it is asked in two: the room reads it to
 * decide whether to draw prices, and the send path reads it to decide whether
 * to take money. Two copies of that condition is how a tray ends up printing a
 * price it never charges, or charging for a gift it showed as free.
 *
 * `MARKET_FLAGS.liveGifts` is the money half and stays the master switch, so a
 * deployment whose service cannot settle a stream gift shows the free tray —
 * the shared on-stream moment, with no payment language anywhere near it.
 */
export function giftsArePriced(status: string | null | undefined): boolean {
  return status === "live" && MARKET_FLAGS.liveGifts;
}
