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
      // Optimistic prepend into every cached lane, then refetch for truth.
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: ["ms", "feed"] },
        (data) => {
          if (!data || post.kind !== "update") return data;
          const first = data.pages[0];
          if (!first) return data;
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
      queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
      if (post.kind === "story") queryClient.invalidateQueries({ queryKey: ["ms", "stories"] });
      toast.success(post.kind === "story" ? "Story posted" : "Posted to the square");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't post right now.")),
  });
}

export function useRepostPost() {
  const queryClient = useQueryClient();
  const patchCaches = (postId: string, reposted: boolean) => {
    const patch = (post: Post): Post => post.id === postId
      ? { ...post, repostedByMe: reposted, repostCount: Math.max(0, post.repostCount + (reposted ? 1 : -1)) }
      : post;
    queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["ms", "feed"] }, (data) => data ? ({
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => item.post ? { ...item, post: patch(item.post) } : item) })),
    }) : data);
  };
  return useMutation({
    mutationFn: ({ postId, repost }: { postId: string; repost: boolean }) => repostPost(postId, repost),
    onMutate: ({ postId, repost }) => patchCaches(postId, repost),
    onError: (error, { postId, repost }) => {
      patchCaches(postId, !repost);
      toast.error(errorMessage(error, "Couldn't update the repost."));
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
      toast.success(result.reposted ? "Reposted to your followers" : "Repost removed");
    },
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

// Optimistic like: flip counts in every cached feed page immediately, roll
// back on failure.
export function useLikePost() {
  const queryClient = useQueryClient();

  const applyLike = (postId: string, liked: boolean) => {
    const patch = (post: Post): Post =>
      post.id === postId
        ? { ...post, likedByMe: liked, likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)) }
        : post;
    queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["ms", "feed"] }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.post ? { ...item, post: patch(item.post) } : item
              ),
            })),
          }
        : data
    );
    queryClient.setQueriesData<{ items: Post[]; nextCursor?: string | null }>(
      { queryKey: ["ms", "profile-posts"] },
      (data) => (data ? { ...data, items: data.items.map(patch) } : data)
    );
  };

  return useMutation({
    mutationFn: ({ postId, like }: { postId: string; like: boolean }) => likePost(postId, like),
    onMutate: async ({ postId, like }) => {
      applyLike(postId, like);
    },
    onError: (error, { postId, like }) => {
      applyLike(postId, !like);
      toast.error(errorMessage(error, "Couldn't update your like."));
    },
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

  const applyBookmark = (postId: string, bookmarked: boolean) => {
    const patch = (post: Post): Post =>
      post.id === postId ? { ...post, bookmarkedByMe: bookmarked } : post;
    queryClient.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ["ms", "feed"] }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.post ? { ...item, post: patch(item.post) } : item
              ),
            })),
          }
        : data
    );
  };

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
      queryClient.invalidateQueries({ queryKey: ["ms", "bookmarks"] });
      toast.success(bookmark ? "Saved to Arkmarks" : "Removed from Arkmarks");
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["ms", "feed"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't add your comment.")),
  });
}

export function useReport() {
  return useMutation({
    mutationFn: reportTarget,
    onSuccess: () => toast.success("Report received — thank you."),
    onError: (error) => toast.error(errorMessage(error, "Couldn't send the report.")),
  });
}
