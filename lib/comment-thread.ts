/**
 * The pure half of a comment thread — the TikTok shape.
 *
 * ONE LEVEL OF NESTING. A top-level comment owns a flat list of replies; a
 * reply to a reply is filed under the same top-level comment and names the
 * person it answers in its text ("@ada …"). That is what keeps a thread
 * readable at any depth of conversation and what lets the reader be a plain
 * list rather than a recursive tree.
 *
 * Kept free of React and of the cache so the arithmetic that decides what a
 * tap draws — the like count going up and down, which comment a reply files
 * under, how a thread is ordered when a payload interleaves replies with their
 * parents — is pinned by `lib/comment-thread.test.ts` rather than discovered
 * in a browser.
 */

/** The fields the thread logic reads; the feed's `Comment` satisfies it. */
export interface ThreadComment {
  id: string;
  parentId: string | null;
  createdAt: string;
  replyCount: number;
  likeCount: number;
  /** Undefined for an anonymous reader — unknown, not false. */
  likedByMe?: boolean | undefined;
}

/**
 * Apply a like or an unlike optimistically.
 *
 * Idempotent on purpose: liking something already liked changes nothing, so a
 * double tap cannot count twice, and an unlike can never take the tally below
 * zero — a payload whose `likeCount` lags its `likedByMe` would otherwise show
 * "-1".
 */
export function applyCommentLike<T extends ThreadComment>(comment: T, like: boolean): T {
  // Unknown reads as not-yet-liked for the toggle: a tap from that state is a like.
  if ((comment.likedByMe ?? false) === like) return comment;
  return {
    ...comment,
    likedByMe: like,
    likeCount: Math.max(0, comment.likeCount + (like ? 1 : -1)),
  };
}

/**
 * The thread a reply lands in, for the optimistic bump and the refetch: the
 * tapped comment's own thread when it is a reply, itself when top-level. The
 * SERVER decides the filing (it takes the tapped id and records who was
 * answered); this only names the thread the client should expect to change.
 */
export function threadOf(target: Pick<ThreadComment, "id" | "parentId">): string {
  return target.parentId ?? target.id;
}

/**
 * Split a flat page into threads.
 *
 * The backend is asked to return ONLY top-level comments from
 * `GET /posts/:id/comments`, but a page that interleaves replies (a backend
 * that ships `parentId` before it filters the list) must still read
 * correctly, and a reply whose parent is not on the page is kept as its own
 * top-level entry rather than vanishing — losing somebody's words is worse
 * than mis-indenting them.
 *
 * Order: top-level NEWEST first (what a reader wants to see is what is
 * happening now); replies within a thread OLDEST first (a thread is read
 * downward, like a conversation).
 */
export function groupThread<T extends ThreadComment>(
  items: readonly T[]
): { comment: T; replies: T[] }[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const replies = new Map<string, T[]>();
  const roots: T[] = [];
  for (const item of items) {
    const parent = item.parentId && byId.has(item.parentId) ? item.parentId : null;
    if (parent) {
      const list = replies.get(parent) ?? [];
      list.push(item);
      replies.set(parent, list);
    } else {
      roots.push(item);
    }
  }
  const byTime = (a: T, b: T) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
  roots.sort((a, b) => byTime(b, a));
  return roots.map((comment) => ({
    comment,
    replies: (replies.get(comment.id) ?? []).sort(byTime),
  }));
}

/**
 * Replace one comment wherever it appears in a page, by id. Returns the same
 * page object when nothing matched so a cache write can be skipped.
 */
export function patchCommentIn<T extends ThreadComment>(
  items: readonly T[],
  id: string,
  patch: (comment: T) => T
): T[] | readonly T[] {
  let touched = false;
  const next = items.map((item) => {
    if (item.id !== id) return item;
    touched = true;
    return patch(item);
  });
  return touched ? next : items;
}

/**
 * The words on a thread's expander.
 *
 * `replyCount` is what the server counts; `loaded` is how many are already on
 * screen. The expander says how many MORE there are to see, so a thread with
 * three replies and one already shown offers "View 2 more replies" rather than
 * repeating a number the reader can see is wrong.
 */
export function expanderLabel(replyCount: number, loaded: number, open: boolean): string | null {
  if (open) return loaded > 0 ? "Hide replies" : null;
  const remaining = Math.max(0, replyCount - loaded);
  if (remaining === 0) return null;
  const more = loaded > 0 ? " more" : "";
  return `View ${remaining}${more} ${remaining === 1 ? "reply" : "replies"}`;
}

/**
 * Which thread holds a comment id, for a permalink opened ON a comment
 * (`/p/:postId?comment=:id`, where a "replied to your comment" notification
 * lands).
 *
 * A top-level comment is its own thread (`parentId: null`); a reply names the
 * thread to open first. Only what is LOADED can be located: a reply whose
 * parent is not on the page cannot be placed without a lookup route, and the
 * answer is then null rather than a guess — scrolling to the wrong comment is
 * worse than scrolling nowhere.
 */
export function locateComment<T extends ThreadComment>(
  items: readonly T[],
  id: string | null | undefined
): { commentId: string; parentId: string | null } | null {
  if (!id) return null;
  const match = items.find((item) => item.id === id);
  if (!match) return null;
  const parent = match.parentId && items.some((item) => item.id === match.parentId)
    ? match.parentId
    : null;
  return { commentId: id, parentId: parent };
}
