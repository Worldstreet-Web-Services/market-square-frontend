"use client";

import { msApi } from "@/lib/api/service";
import { apiFetch } from "@/lib/api/client";
import { unwrap } from "@/lib/api/envelope";
import { z } from "zod";
import type { DeepLink } from "@/lib/api/schemas";
import {
  BookmarkResultSchema,
  CommentSchema,
  CommentsPageSchema,
  FeedPageSchema,
  LikeResultSchema,
  MentionSchema,
  RepostResultSchema,
  PostSchema,
  type Lane,
  type Post,
  type ReportReason,
  type Mention,
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
  quotedPostId?: string;
  mentions?: Mention[];
}) {
  return PostSchema.parse(await msApi.post("/posts", input));
}

export async function repostPost(postId: string, repost: boolean) {
  const path = `/posts/${postId}/repost`;
  return RepostResultSchema.parse(repost ? await msApi.post(path) : await msApi.del(path));
}

const MediaUploadSchema = z.object({ url: z.string(), mediaType: z.string(), size: z.number() });

export async function uploadPostMedia(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await apiFetch("/api/market-square/media", { method: "POST", body: form }, { requireAuth: true });
  return MediaUploadSchema.parse(await unwrap<unknown>(response, "Couldn't upload media."));
}

const MentionSearchSchema = z.object({ items: z.array(MentionSchema) });

export async function searchMentions(query: string) {
  return MentionSearchSchema.parse(await msApi.get("/mentions/search", { q: query.trim(), limit: 8 }));
}

// Arkmarks. POST saves, DELETE unsaves; GET /me/bookmarks pages the saved
// posts back as feed items, so the Arkmarks tab reuses the timeline shape.
export async function bookmarkPost(postId: string, bookmark: boolean) {
  const path = `/posts/${postId}/bookmark`;
  return BookmarkResultSchema.parse(
    (bookmark ? await msApi.post(path) : await msApi.del(path)) ?? {}
  );
}

export async function fetchBookmarks(cursor?: string) {
  return FeedPageSchema.parse(await msApi.authedGet("/me/bookmarks", { limit: 30, cursor }));
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
