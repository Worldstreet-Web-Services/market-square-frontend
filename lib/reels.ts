import type { FeedItem } from "@/features/feed/lib/types";

/**
 * Mobile home is REELS, and a reel must have something to show.
 *
 * A text-only post rendered as a full-viewport slide is a wall of black with a
 * sentence floating in the middle of it. That is what "the text posts are not
 * showing properly" was: not a styling bug, a surface mismatch. Text wants a
 * timeline where it can be read at reading size, which is what Explore's Posts
 * tab is. Streams and platform cards keep their slides, because they carry
 * their own artwork and the Live lane is built entirely from them.
 */
export function reelItems(items: FeedItem[]): FeedItem[] {
  return items.filter((item) => item.type !== "post" || Boolean(item.post?.mediaUrl));
}

export interface ReelSlide {
  item: FeedItem;
  /** React key. A repeated reel needs its own, or the pass collides. */
  key: string;
}

/**
 * The feed does not end.
 *
 * Reaching the bottom of a reels feed is the moment a person leaves, so there
 * is no bottom: while the server still has pages we page normally, and once it
 * is exhausted the loaded reels repeat. `cycle` is a render-key salt, so a
 * repeat costs no request and produces no duplicate keys.
 *
 * Looping only kicks in once the server is actually out of pages. Repeating
 * while more exist would show somebody the same reel twice while fresh ones
 * were still waiting.
 */
export function reelSlides(items: FeedItem[], cycle: number, exhausted: boolean): ReelSlide[] {
  if (!exhausted || items.length === 0) {
    return items.map((item) => ({ item, key: item.id }));
  }
  return Array.from({ length: cycle + 1 }).flatMap((_, pass) =>
    items.map((item) => ({ item, key: pass === 0 ? item.id : `${item.id}#${pass}` }))
  );
}
