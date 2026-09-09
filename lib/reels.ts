/**
 * Reels do not end.
 *
 * Reaching the bottom of a reels feed is the moment a person leaves, so there
 * is no bottom: while the server still has pages the feed pages normally, and
 * once it is exhausted the loaded reels repeat. `cycle` is a render-key salt,
 * so a repeat costs no request and produces no duplicate React keys.
 *
 * Looping only starts once the server is genuinely out of pages. Repeating
 * while more exist would show somebody the same clip twice while fresh ones
 * were still waiting.
 *
 * Generic over anything with an id, because the rule is about the sequence and
 * not about what a reel happens to be.
 */
export interface ReelSlide<T> {
  item: T;
  /** React key. A repeated reel needs its own, or the pass collides. */
  key: string;
}

export function reelSlides<T extends { id: string }>(
  items: T[],
  cycle: number,
  exhausted: boolean
): Array<ReelSlide<T>> {
  if (!exhausted || items.length === 0) {
    return items.map((item) => ({ item, key: item.id }));
  }
  return Array.from({ length: cycle + 1 }).flatMap((_, pass) =>
    items.map((item) => ({ item, key: pass === 0 ? item.id : `${item.id}#${pass}` }))
  );
}
