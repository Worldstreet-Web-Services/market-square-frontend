"use client";

import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { uploadFile } from "@/lib/api/upload";
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

// Single post, by id — the permalink's source. Public GET: a signed-out
// reader can open a shared link, and a signed-in one still gets likedByMe.
export async function fetchPost(postId: string) {
  return PostSchema.parse(await msApi.get(`/posts/${postId}`));
}

export async function repostPost(postId: string, repost: boolean) {
  const path = `/posts/${postId}/repost`;
  return RepostResultSchema.parse(repost ? await msApi.post(path) : await msApi.del(path));
}

/**
 * Post media goes through the service's own `POST /uploads`, which decides the
 * stored content type and extension server-side from the bytes, never from the
 * client's filename, and namespaces the key by the verified user.
 *
 * The BFF used to write these to `public/uploads/` using the client-supplied
 * extension, which let an `x.html` declared as `image/png` be served back as
 * same-origin HTML — stored XSS against the session cookie. That handler is
 * gone; do not reintroduce a local-disk upload path.
 */
export async function uploadPostMedia(file: File) {
  return uploadFile(file);
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
