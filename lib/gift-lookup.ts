import { LIVE_GIFTS, type LiveGift } from "./gifts.ts";

/**
 * The gift a recorded id refers to.
 *
 * A tip stores which gift was sent — `rose`, `lion`, `phoenix` — and the
 * catalogue that gives it a name and a picture lives here, on the client. The
 * service deliberately does not validate the id against a list (the tray grows
 * without a deploy there), which means the id in an old tip can outlive the
 * gift it named.
 *
 * So a miss is NORMAL, not an error, and it answers null: a receipt for a gift
 * this build no longer carries falls back to showing the amount, which is the
 * part that was always true. Inventing a placeholder object would be worse —
 * it would show somebody a gift that was never sent.
 */
export function giftById(giftId: string | null | undefined): LiveGift | null {
  if (!giftId) return null;
  const wanted = giftId.trim().toLowerCase();
  return LIVE_GIFTS.find((gift) => gift.id.toLowerCase() === wanted) ?? null;
}

/**
 * What to call what arrived — "a Lion", or the amount when the gift is unknown.
 *
 * Takes the amount as its fallback rather than reaching for one, because the
 * caller already formats money and two formatters would drift.
 */
export function giftLabel(giftId: string | null | undefined, amountLabel: string): string {
  const gift = giftById(giftId);
  return gift ? gift.name : amountLabel;
}
