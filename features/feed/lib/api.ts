"use client";

import { msApi } from "@/lib/api/service";
import type { DeepLink } from "@/lib/api/schemas";
import {
  CommentSchema,
  CommentsPageSchema,
  FeedPageSchema,
  LikeResultSchema,
  PostSchema,
  type Lane,
  type Post,
  type ReportReason,
} from "@/features/feed/lib/types";

export async function fetchFeed(lane: Lane, cursor?: string) {
  return FeedPageSchema.parse(await msApi.get("/feed", { lane, limit: 30, cursor }));
}

// GET /stories returns FeedItems (scope=following: authors the viewer
// follows); the row only needs the posts inside them.
export async function fetchStories(): Promise<{ items: Post[] }> {
  const page = FeedPageSchema.parse(await msApi.get("/stories", { scope: "following", limit: 30 }));
  return { items: page.items.flatMap((item) => (item.post ? [item.post] : [])) };
}

export async function createPost(input: {
  kind: "update" | "story";
  text: string;
  mediaUrl?: string;
  deepLink?: DeepLink;
}) {
  return PostSchema.parse(await msApi.post("/posts", input));
}

export async function likePost(postId: string, like: boolean) {
  const path = `/posts/${postId}/like`;
  return LikeResultSchema.parse(like ? await msApi.post(path) : await msApi.del(path));
}

export async function fetchComments(postId: string) {
  return CommentsPageSchema.parse(await msApi.get(`/posts/${postId}/comments`));
}

export async function addComment(postId: string, text: string) {
  return CommentSchema.parse(await msApi.post(`/posts/${postId}/comments`, { text }));
}

export async function reportTarget(input: {
  targetType: "post" | "comment" | "profile" | "stream_message";
  targetId: string;
  reason: ReportReason;
  note?: string;
}) {
  return msApi.post<{ id: string; status: string }>("/reports", input);
}
