/**
 * THE FEATURED RANK — who leads the people directory, and in what order.
 *
 * An operator-set position on a profile (tsionark-monorepo PR #214): rank 1
 * is the first card everyone else sees in "Make some friends" on the
 * Square's Home, on the WSWS app's /square, and in onboarding's "people to
 * follow"; rank 2 the second; and so on. Unranked profiles follow in the
 * usual most-followed order. The service refuses a rank another profile
 * already holds (409) rather than moving anybody, so an operator changing
 * the order clears one seat before filling it.
 *
 * The rank ORDERS the directory; it never ADMITS anyone to it. Filters run
 * first, so a viewer who already follows a featured account sees the next
 * card, and a featured account never sees its own card.
 */
export const FEATURED_RANK_MIN = 1;
export const FEATURED_RANK_MAX = 50;

/** What an operator typed, as a rank the service accepts — or null when it is not one. */
export function parseFeaturedRank(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const rank = Number(trimmed);
  return rank >= FEATURED_RANK_MIN && rank <= FEATURED_RANK_MAX ? rank : null;
}

/** The control's label for a profile's current standing. */
export function featuredLabel(rank: number | null | undefined): string {
  return rank === null || rank === undefined ? "Not featured" : `Featured #${rank}`;
}
