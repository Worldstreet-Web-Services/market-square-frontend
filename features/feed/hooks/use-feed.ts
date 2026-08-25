"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import type { DeepLink } from "@/lib/api/schemas";
import {
  addComment,
  bookmarkPost,
  fetchBookmarks,
  createPost,
  fetchComments,
  fetchFeed,
  fetchPost,
  fetchStories,
  likePost,
  repostPost,
  uploadPostMedia,
  searchMentions,
  reportTarget,
} from "@/features/feed/lib/api";
import type { FeedPage, Lane, Mention, Post } from "@/features/feed/lib/types";
import {
  invalidatePostLists,
  patchPostEverywhere,
  reconcilePost,
} from "@/features/feed/lib/cache";

export function useFeed(lane: Lane) {
  return useInfiniteQuery({
    queryKey: ["ms", "feed", lane],
    queryFn: ({ pageParam }) => fetchFeed(lane, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** One post by id, for the permalink at /p/[id]. */
export function usePost(postId: string) {
  return useQuery({
    queryKey: ["ms", "post", postId],
    queryFn: () => fetchPost(postId),
    enabled: postId.length > 0,
  });
}

export function useStories() {
  return useQuery({
    queryKey: ["ms", "stories"],
    queryFn: fetchStories,
    staleTime: 60_000,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: "update" | "story";
      text: string;
      mediaUrl?: string;
      deepLink?: DeepLink;
      quotedPostId?: string;
      mentions?: Mention[];
    }) => createPost(input),
    onSuccess: (post) => {
      // Two halves, and both are needed. The prepend puts the post on screen
      // instantly; the invalidation below reconciles it with the server, which
      // may reshape it (hydrated author, resolved deep link, moderation).
      // Relying on either one alone is what left readers reaching for reload.
      if (post.kind === "update") {
        queryClient.setQueriesData<InfiniteData<FeedPage>>(
          { queryKey: ["ms", "feed"] },
          (data) => {
            if (!data) return data;
            const first = data.pages[0];
            if (!first) return data;
            // Already reconciled by a refetch that beat us here.
            if (first.items.some((item) => item.post?.id === post.id)) return data;
            const item = {
              id: `local_${post.id}`,
              type: "post" as const,
              occurredAt: post.createdAt,
              repostedBy: null,
              deepLink: post.deepLink,
              post,
              stream: null,
              activity: null,
              platformEvent: null,
            };
            return {
              ...data,
              pages: [{ ...first, items: [item, ...first.items] }, ...data.pages.slice(1)],
            };
          }
        );
        // The author's own Posts tab renders from its own cache and used to
        // keep the pre-post list until it was remounted.
        queryClient.setQueriesData<{ items: Post[]; nextCursor?: string | null }>(
          { queryKey: ["ms", "profile-posts"] },
          (data) =>
            data && !data.items.some((item) => item.id === post.id)
              ? { ...data, items: [post, ...data.items] }
              : data
        );
      }
      // Freshly published, so it can be read back on its permalink at once.
      queryClient.setQueryData<Post>(["ms", "post", post.id], post);
      toast.success(post.kind === "story" ? "Story posted" : "Posted to the square");
    },
    // onSettled, not onSuccess: a request that errored may still have landed
    // server-side, so the lists reconcile either way.
    onSettled: (post, _error, input) => {
      invalidatePostLists(queryClient);
      if (input.kind === "story" || post?.kind === "story") {
        void queryClient.invalidateQueries({ queryKey: ["ms", "stories"] });
      }
      // A quote is a new post pointing at an existing one; refresh the
      // original so any server-side counter it keeps comes back current.
      if (input.quotedPostId) reconcilePost(queryClient, input.quotedPostId);
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't post right now.")),
  });
}

export function useRepostPost() {
  const queryClient = useQueryClient();
  // Every cache the post lives in, not just the timeline: the same card is
  // rendered on a profile tab, in Arkmarks and on its permalink.
  const patchCaches = (postId: string, reposted: boolean) =>
    patchPostEverywhere(queryClient, postId, (post) => ({
      ...post,
      repostedByMe: reposted,
      repostCount: Math.max(0, post.repostCount + (reposted ? 1 : -1)),
    }));
  return useMutation({
    mutationFn: ({ postId, repost }: { postId: string; repost: boolean }) => repostPost(postId, repost),
    onMutate: ({ postId, repost }) => patchCaches(postId, repost),
    onError: (error, { postId, repost }) => {
      patchCaches(postId, !repost);
      toast.error(errorMessage(error, "Couldn't update the repost."));
    },
    onSuccess: (result) => {
      // A repost inserts a NEW attributed row into followers' timelines, so
      // the lists genuinely have to refetch rather than just go stale.
      invalidatePostLists(queryClient);
      toast.success(result.reposted ? "Reposted to your followers" : "Repost removed");
    },
    onSettled: (_result, _error, { postId }) => reconcilePost(queryClient, postId),
  });
}

export function useUploadPostMedia() {
  return useMutation({
    mutationFn: uploadPostMedia,
    onError: (error) => toast.error(errorMessage(error, "Couldn't upload that file.")),
  });
}

export function useMentionSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "mentions", query.trim()],
    queryFn: () => searchMentions(query),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Optimistic like.
 *
 * The flip lands in every cache the post appears in — timeline, Arkmarks, the
 * author's profile tab, the permalink — so navigating between surfaces after
 * a tap shows one consistent state instead of whichever version that surface
 * happened to have cached. `reconcilePost` then lines the count back up with
 * the server without refetching the world on every tap.
 */
export function useLikePost() {
  const queryClient = useQueryClient();

  const applyLike = (postId: string, liked: boolean) =>
    patchPostEverywhere(queryClient, postId, (post) => ({
      ...post,
      likedByMe: liked,
      likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)),
    }));

  return useMutation({
    mutationFn: ({ postId, like }: { postId: string; like: boolean }) => likePost(postId, like),
    onMutate: async ({ postId, like }) => {
      applyLike(postId, like);
    },
    onError: (error, { postId, like }) => {
      applyLike(postId, !like);
      toast.error(errorMessage(error, "Couldn't update your like."));
    },
    onSettled: (_result, _error, { postId }) => reconcilePost(queryClient, postId),
  });
}

/**
 * Arkmarks.
 *
 * The bookmark endpoints ship on their own cadence. Until they land the API
 * answers 404, and a 404 here is "not deployed", not "your save failed" — so
 * the mutation rolls the optimistic flag back and reports the feature as
 * unavailable instead of raising an error toast. `unavailable` is what the
 * button reads to go quiet; it never invents a saved state.
 */
export function useBookmarkPost() {
  const queryClient = useQueryClient();
  const [unavailable, setUnavailable] = useState(false);

  const applyBookmark = (postId: string, bookmarked: boolean) =>
    patchPostEverywhere(queryClient, postId, (post) => ({
      ...post,
      bookmarkedByMe: bookmarked,
    }));

  const mutation = useMutation({
    mutationFn: ({ postId, bookmark }: { postId: string; bookmark: boolean }) =>
      bookmarkPost(postId, bookmark),
    onMutate: ({ postId, bookmark }) => applyBookmark(postId, bookmark),
    onError: (error, { postId, bookmark }) => {
      applyBookmark(postId, !bookmark);
      if (errorCode(error) === "NOT_FOUND") {
        setUnavailable(true);
        return;
      }
      toast.error(errorMessage(error, "Couldn't update your Arkmark."));
    },
    onSuccess: (_result, { bookmark }) => {
      // The Arkmarks list gains or loses a row, so it refetches for real.
      queryClient.invalidateQueries({ queryKey: ["ms", "bookmarks"] });
      toast.success(bookmark ? "Saved to Arkmarks" : "Removed from Arkmarks");
    },
    onSettled: (_result, _error, { postId }) => reconcilePost(queryClient, postId),
  });

  return { ...mutation, unavailable };
}

export function useBookmarks() {
  return useInfiniteQuery({
    queryKey: ["ms", "bookmarks"],
    queryFn: ({ pageParam }) => fetchBookmarks(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // A missing endpoint is a deployment gap, not a transient fault — retrying
    // it just delays the quiet unavailable state.
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
}

export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "comments", postId],
    queryFn: () => fetchComments(postId),
    enabled,
  });
}

export function useAddComment(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addComment(postId, text),
    // The reply is visible at once and the tally moves with it, on every
    // surface that draws this post rather than only the one being looked at.
    onMutate: () =>
      patchPostEverywhere(queryClient, postId, (post) => ({
        ...post,
        commentCount: post.commentCount + 1,
      })),
    onError: (error) => {
      patchPostEverywhere(queryClient, postId, (post) => ({
        ...post,
        commentCount: Math.max(0, post.commentCount - 1),
      }));
      toast.error(errorMessage(error, "Couldn't add your comment."));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "comments", postId] });
      reconcilePost(queryClient, postId);
    },
  });
}

export function useReport() {
  return useMutation({
    mutationFn: reportTarget,
    onSuccess: () => toast.success("Report received — thank you."),
    onError: (error) => toast.error(errorMessage(error, "Couldn't send the report.")),
  });
}
