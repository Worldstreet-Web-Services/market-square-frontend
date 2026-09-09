/**
 * "N new posts" — the X pattern, kept pure.
 *
 * The timeline's query refetches on focus, on remount and whenever a post
 * is published or reconciled. Each refetch can put posts ABOVE the ones the
 * reader is looking at, and inserting them under their eye moves the page
 * while they read it. So the list the reader sees is anchored: `anchorId` is
 * the id of the first item they were shown, and anything the server now
 * places above it is HELD behind a pill until they ask for it.
 *
 * Everything that decides what is held, what is counted and what the pill
 * shows is here, with no React in it, so `lib/new-posts.test.ts` can pin
 * the cases that go wrong silently: a reader's own post, a repost of
 * something already on the page, an anchor the server has since evicted.
 */

/** What the split needs to know about a feed item. */
export interface FeedLike {
  id: string;
  post?: {
    id: string;
    authorId: string;
    author?: { id: string; username: string; displayName: string; avatarUrl?: string | null } | null;
  } | null;
  repostedBy?: { id: string } | null;
}

export interface HeldSplit<T> {
  /** What the reader sees, in server order — the head's own posts, then the anchored tail. */
  shown: T[];
  /** What waits behind the pill, in server order. */
  held: T[];
}

/**
 * The reader's own posts are never held: the composer already puts them at
 * the head of the list optimistically, and holding a post you just published
 * behind "1 new post" would read as it having failed.
 */
export function isOwnItem(item: FeedLike, meId: string | null): boolean {
  if (!meId) return false;
  return item.post?.authorId === meId || item.post?.author?.id === meId;
}

/**
 * Split a fresh page into what stays on screen and what is held.
 *
 * No anchor (a fresh lane, or a reader at the top) means nothing is held. An
 * anchor the server no longer returns — the list moved on past it — also
 * means nothing is held: there is no honest way to say what is "new" against
 * a reference that is gone, and showing the fresh list is better than a pill
 * that counts everything.
 */
export function splitHeld<T extends FeedLike>(
  items: readonly T[],
  anchorId: string | null,
  meId: string | null
): HeldSplit<T> {
  if (!anchorId) return { shown: [...items], held: [] };
  const index = items.findIndex((item) => item.id === anchorId);
  if (index <= 0) return { shown: [...items], held: [] };
  const head = items.slice(0, index);
  const own = head.filter((item) => isOwnItem(item, meId));
  const held = head.filter((item) => !isOwnItem(item, meId));
  return { shown: [...own, ...items.slice(index)], held };
}

/**
 * How many the pill says. A repost of a post already on the page is not
 * news — the reader has seen those words — so it is held (it still moves in
 * on tap, in server order) but not counted.
 */
export function countNew<T extends FeedLike>(held: readonly T[], shown: readonly T[]): number {
  const seen = new Set(shown.flatMap((item) => (item.post ? [item.post.id] : [])));
  return held.filter((item) => !(item.post && seen.has(item.post.id))).length;
}

/** Up to three distinct authors among the held posts, first seen first, for the pill's stack. */
export function newAuthors<T extends FeedLike>(
  held: readonly T[],
  limit = 3
): NonNullable<NonNullable<FeedLike["post"]>["author"]>[] {
  const out: NonNullable<NonNullable<FeedLike["post"]>["author"]>[] = [];
  const seen = new Set<string>();
  for (const item of held) {
    const author = item.post?.author;
    if (!author || seen.has(author.id)) continue;
    seen.add(author.id);
    out.push(author);
    if (out.length === limit) break;
  }
  return out;
}

/** The pill's words. */
export function newPostsLabel(count: number): string {
  return count === 1 ? "1 new post" : `${count} new posts`;
}

/** Where the anchor goes once the reader has seen the head: the first item. */
export function anchorFor<T extends FeedLike>(items: readonly T[]): string | null {
  return items[0]?.id ?? null;
}
