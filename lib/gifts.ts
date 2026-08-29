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
 * largest. It is deliberately a SUPERSET of `TIP_PRESETS_KASH` — every one of
 * 1 / 5 / 10 / 25 / 50 / 100 is a gift price — so a "10" means the same thing
 * whether it arrives as a gift or as a typed amount.
 */
export interface LiveGift {
  id: string;
  name: string;
  art: string;
  priceKash: string;
}

/**
 * The tray, cheapest first — the order the file draws them in is the order
 * they read in, and price is what makes that order mean something.
 */
export const LIVE_GIFTS: LiveGift[] = [
  { id: "rose", name: "Rose", art: "/gifts/gift-13.png", priceKash: "1" },
  { id: "heart", name: "Heart", art: "/gifts/gift-06.png", priceKash: "2" },
  { id: "book", name: "Book", art: "/gifts/gift-03.png", priceKash: "5" },
  { id: "dove", name: "Dove", art: "/gifts/gift-02.png", priceKash: "10" },
  { id: "boots", name: "Boots", art: "/gifts/gift-10.png", priceKash: "15" },
  { id: "jacket", name: "Jacket", art: "/gifts/gift-08.png", priceKash: "20" },
  { id: "phone", name: "Phone", art: "/gifts/gift-09.png", priceKash: "25" },
  { id: "router", name: "Router", art: "/gifts/gift-05.png", priceKash: "50" },
  { id: "lion", name: "Lion", art: "/gifts/gift-01.png", priceKash: "75" },
  { id: "bull", name: "Bull", art: "/gifts/gift-12.png", priceKash: "100" },
  { id: "bank", name: "Bank", art: "/gifts/gift-11.png", priceKash: "150" },
  { id: "phoenix", name: "Phoenix", art: "/gifts/gift-04.png", priceKash: "250" },
  { id: "car", name: "Car", art: "/gifts/gift-07.png", priceKash: "500" },
  { id: "kash", name: "KASH coin", art: "/gifts/gift-14.png", priceKash: "1000" },
];
