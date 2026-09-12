"use client";

import type { InfiniteData, QueryClient } from "@tanstack/react-query";
// Relative + .ts on purpose: this is a RUNTIME import, and the tests run on
// `node --test`, which resolves neither the `@/` alias nor extensionless
// specifiers. Type-only imports below can keep the alias — they are erased.
import { invalidateContentSurfaces } from "../../../lib/api/invalidate.ts";
import type { FeedPage, Post } from "@/features/feed/lib/types";

/**
 * Where a post is cached.
 *
 * The same post is rendered from FOUR different caches, and a mutation that
 * only touched one of them left the other three showing the pre-mutation
 * state until they happened to refetch — which is what made the app feel
 * stale after every action:
 *
 *   ["ms","feed", lane]            InfiniteData<FeedPage>  — every timeline lane
 *   ["ms","bookmarks"]             InfiniteData<FeedPage>  — /arkmarks
 *   ["ms","profile-posts", user]   { items: Post[] }       — a profile's Posts tab
 *   ["ms","post", id]              Post                    — the /p/[id] permalink
 *
 * Keys are matched by PREFIX, so one call covers every lane and every loaded
 * cursor without the caller having to know which pages are in memory.
 *
 * ─── AND PREFIX MATCHING IS WHY EVERY WRITER MUST CHECK THE SHAPE ───────────
 * A FIFTH cache now lives under the feed prefix and is NOT an infinite list:
 *
 *   ["ms","feed", lane, key, "head"]   FeedPage   — the 30s freshness check
 *
 * `useFeedHead` is a plain `useQuery`, so its value is a bare `FeedPage` with
 * `items` and no `pages`. Every `setQueriesData` here matches it, and every
 * one of them used to reach straight for `data.pages` behind nothing but a
 * `data ?` null check — which passes, because the value is a perfectly good
 * object. The result was a TypeError, "Cannot read properties of undefined
 * (reading '0')" on publish and "(reading 'map')" on like and bookmark,
 * thrown INSIDE onSuccess: the post was created on the server, then the
 * mutation went to error, the sheet never closed, and the reader was invited
 * to press Post again.
 *
 * So a null check is not a shape check. `isInfiniteFeed` is the shape check,
 * and anything it does not recognise is returned untouched rather than
 * guessed at. Adding a sixth shape under one of these prefixes is fine; the
 * writers will leave it alone.
 */

/**
 * Is this cache entry an infinite feed, as opposed to some other value that
 * happens to sit under the same key prefix?
 *
 * Deliberately structural rather than a key comparison: the whole point of
 * prefix matching is that these writers do not enumerate the keys they touch,
 * so the guard must not either.
 */
export function isInfiniteFeed(data: unknown): data is InfiniteData<FeedPage> {
  return Array.isArray((data as InfiniteData<FeedPage> | undefined)?.pages);
}

/** Same question for the flat `{ items }` caches. */
function hasItems<T extends { items: unknown[] }>(data: unknown): data is T {
  return Array.isArray((data as { items?: unknown[] } | undefined)?.items);
}
export const POST_LIST_KEYS = {
  feed: ["ms", "feed"] as const,
  bookmarks: ["ms", "bookmarks"] as const,
  profilePosts: ["ms", "profile-posts"] as const,
  post: ["ms", "post"] as const,
  stories: ["ms", "stories"] as const,
};

/** Apply `patch` to one post wherever it is cached. */
export function patchPostEverywhere(
  client: QueryClient,
  postId: string,
  patch: (post: Post) => Post
): void {
  const applyIfMatch = (post: Post): Post => (post.id === postId ? patch(post) : post);

  for (const key of [POST_LIST_KEYS.feed, POST_LIST_KEYS.bookmarks]) {
    client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: key }, (data) =>
      isInfiniteFeed(data)
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.post ? { ...item, post: applyIfMatch(item.post) } : item
              ),
            })),
          }
        : data
    );
  }

  // Same shape check on the flat caches. Neither prefix has a foreign shape
  // under it today; both are guarded anyway, because the feed prefix did not
  // either until somebody added a perfectly reasonable query to it.
  client.setQueriesData<{ items: Post[]; nextCursor?: string | null }>(
    { queryKey: POST_LIST_KEYS.profilePosts },
    (data) => (hasItems<{ items: Post[] }>(data) ? { ...data, items: data.items.map(applyIfMatch) } : data)
  );

  client.setQueriesData<{ items: Post[] }>({ queryKey: POST_LIST_KEYS.stories }, (data) =>
    hasItems<{ items: Post[] }>(data) ? { ...data, items: data.items.map(applyIfMatch) } : data
  );

  client.setQueryData<Post>([...POST_LIST_KEYS.post, postId], (post) =>
    post ? patch(post) : post
  );
}

/**
 * Clear the "Pinned" flag from every cached post.
 *
 * A profile has ONE pinned post, so pinning a second silently unpins the
 * first. Without this, both cards wear the label until the next natural
 * refetch — a state the product never actually has. Narrow on purpose: this
 * touches one boolean, rather than being a general "patch every post" hook
 * that would invite sweeping edits nobody can audit.
 */
export function clearPinnedEverywhere(client: QueryClient): void {
  const clear = (post: Post): Post =>
    post.pinnedByAuthor ? { ...post, pinnedByAuthor: false } : post;

  for (const key of [POST_LIST_KEYS.feed, POST_LIST_KEYS.bookmarks]) {
    client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: key }, (data) =>
      isInfiniteFeed(data)
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.post ? { ...item, post: clear(item.post) } : item)),
            })),
          }
        : data
    );
  }

  for (const key of [POST_LIST_KEYS.profilePosts, POST_LIST_KEYS.stories]) {
    client.setQueriesData<{ items: Post[] }>({ queryKey: key }, (data) =>
      hasItems<{ items: Post[] }>(data) ? { ...data, items: data.items.map(clear) } : data
    );
  }

  client.setQueriesData<Post>({ queryKey: POST_LIST_KEYS.post }, (post) => (post ? clear(post) : post));
}

/**
 * Reconcile a post's server-owned fields after a mutation settles.
 *
 * The optimistic patch above is a guess at what the server will do; this is
 * the correction. The permalink is refetched immediately because it is exact
 * and cheap, while the LISTS are only marked stale (`refetchType: "none"`).
 *
 * That distinction matters: a like or a bookmark is a high-frequency action,
 * and eagerly refetching every loaded page of every lane on each tap would
 * hammer the service and re-render a timeline the reader is mid-scroll
 * through, for a number that the optimistic patch already has right. Marking
 * stale means the very next natural refetch — remount, window focus, lane
 * switch — carries the server's truth, and nothing is left permanently
 * diverged.
 */
export function reconcilePost(client: QueryClient, postId: string): void {
  void client.invalidateQueries({ queryKey: [...POST_LIST_KEYS.post, postId] });
  for (const key of [
    POST_LIST_KEYS.feed,
    POST_LIST_KEYS.bookmarks,
    POST_LIST_KEYS.profilePosts,
  ]) {
    void client.invalidateQueries({ queryKey: key, refetchType: "none" });
  }
}

/**
 * A post has appeared or disappeared: refetch every list that could contain
 * it, right now.
 *
 * Unlike `reconcilePost` this DOES refetch — a reader who just published
 * something expects to see it without reaching for reload. Invalidating an
 * infinite query refetches the pages already in memory rather than collapsing
 * back to page one, so scroll position survives.
 */
export function invalidatePostLists(client: QueryClient): void {
  // The canonical list lives in lib/ because the admin console has to
  // invalidate exactly this set too when it removes reported content, and
  // slices never import each other. Two copies of a key list drift apart
  // silently, and the symptom — content lingering in one list — is invisible
  // in review.
  invalidateContentSurfaces(client);
}
