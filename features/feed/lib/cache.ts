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
 */
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
      data
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

  client.setQueriesData<{ items: Post[]; nextCursor?: string | null }>(
    { queryKey: POST_LIST_KEYS.profilePosts },
    (data) => (data ? { ...data, items: data.items.map(applyIfMatch) } : data)
  );

  client.setQueriesData<{ items: Post[] }>({ queryKey: POST_LIST_KEYS.stories }, (data) =>
    data ? { ...data, items: data.items.map(applyIfMatch) } : data
  );

  client.setQueryData<Post>([...POST_LIST_KEYS.post, postId], (post) =>
    post ? patch(post) : post
  );
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
