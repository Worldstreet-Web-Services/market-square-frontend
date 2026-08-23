"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import type { DeepLink } from "@/lib/api/schemas";
import {
  addComment,
  createPost,
  fetchComments,
  fetchFeed,
  fetchStories,
  likePost,
  reportTarget,
} from "@/features/feed/lib/api";
import type { FeedPage, Lane, Post } from "@/features/feed/lib/types";

export function useFeed(lane: Lane) {
  return useInfiniteQuery({
    queryKey: ["ms", "feed", lane],
    queryFn: ({ pageParam }) => fetchFeed(lane, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
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
