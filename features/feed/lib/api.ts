"use client";

import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { uploadFile } from "@/lib/api/upload";
import type { DeepLink } from "@/lib/api/schemas";
import {
  BookmarkResultSchema,
  CommentSchema,
  CommentLikeResultSchema,
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

// `topics` filters the lane server-side (the same comma-joined parameter
// /search and /streams take). It is omitted entirely when nothing is chosen —
// an empty `topics=` would read as "match no topics" rather than "no filter".
export async function fetchFeed(
  lane: Lane,
  cursor?: string,
  topics: string[] = [],
  /** One discussion. Replaces the lane rather than narrowing it. */
  hashtag?: string
) {
  return FeedPageSchema.parse(
    await msApi.get("/feed", {
      lane,
      limit: 30,
      cursor,
      ...(topics.length > 0 ? { topics: topics.join(",") } : {}),
      ...(hashtag ? { hashtag } : {}),
    })
  );
}

// GET /stories returns FeedItems; the row only needs the posts inside them.
//
// scope=all, NOT following. On an account that follows nobody, `following`
// returns only the viewer's own stories, so the rail looked broken to every new
// user. `all` is server-ranked — own, then followed, then everyone, each
// newest-first — and that ORDER IS AUTHORITATIVE: the rail renders it as given
// and must not re-sort it (see the note on ordering in stories-row).
export async function fetchStories(): Promise<{ items: Post[] }> {
  const page = FeedPageSchema.parse(await msApi.get("/stories", { scope: "all", limit: 30 }));
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

export async function fetchComments(postId: string, cursor?: string) {
  return CommentsPageSchema.parse(
    await msApi.get(`/posts/${postId}/comments`, cursor ? { cursor } : {})
  );
}

/**
 * A comment, or a REPLY when `parentId` names the comment the reader TAPPED
 * Reply on — top-level or reply alike; the service files it under the
 * top-level parent and records who was answered. `parentId` is only sent
 * when present.
 */
export async function addComment(
  postId: string,
  text: string,
  parentId?: string | null,
  mentions?: Mention[]
) {
  return CommentSchema.parse(
    await msApi.post(`/posts/${postId}/comments`, {
      text,
      ...(parentId ? { parentId } : {}),
      // Structured picks, so the service records exactly who was meant.
      ...(mentions && mentions.length > 0 ? { mentions } : {}),
    })
  );
}

/** `GET /comments/:id` — one comment, for a permalink opened ON it (`?comment=`). */
export async function fetchComment(commentId: string) {
  return CommentSchema.parse(await msApi.get(`/comments/${commentId}`));
}

/** `GET /comments/:id/replies` — a thread's replies, oldest first. */
export async function fetchReplies(commentId: string, cursor?: string) {
  return CommentsPageSchema.parse(
    await msApi.get(`/comments/${commentId}/replies`, cursor ? { cursor } : {})
  );
}

/** `POST|DELETE /comments/:id/like` — idempotent both ways. */
export async function likeComment(commentId: string, like: boolean) {
  const path = `/comments/${commentId}/like`;
  return CommentLikeResultSchema.parse(like ? await msApi.post(path) : await msApi.del(path));
}

/** `DELETE /comments/:id` — the comment's author, or the post's. */
export async function deleteComment(commentId: string) {
  await msApi.del(`/comments/${commentId}`);
}

export async function reportTarget(input: {
  targetType: "post" | "comment" | "profile" | "stream_message";
  targetId: string;
  reason: ReportReason;
  note?: string;
}) {
  return msApi.post<{ id: string; status: string }>("/reports", input);
}

/**
 * Edit a post — `PATCH /posts/:id`.
 *
 * TEXT AND TOPICS ONLY, and that is a product decision rather than a gap:
 * media, the quoted post and the deep link are not editable, because swapping
 * the picture under something people have already liked changes what they
 * endorsed. New media means delete and repost.
 *
 * Author only — 403 for anybody else, admins included: admins remove, they do
 * not rephrase. Same 2000-character cap as create, 400 on empty, 404 once
 * deleted. Works on a story too.
 */
export async function editPost(
  postId: string,
  input: { text: string; topics?: string[] }
) {
  return PostSchema.parse(
    await msApi.patch(`/posts/${postId}`, {
      text: input.text.trim(),
      ...(input.topics ? { topics: input.topics } : {}),
    })
  );
}

/**
 * Delete a post or a story — `DELETE /posts/:id`.
 *
 * ONE route for both, because a story IS a post (`kind: "story"`). A soft
 * remove by the author or an admin; the post then 404s.
 */
export async function deletePost(postId: string) {
  return msApi.del<unknown>(`/posts/${postId}`);
}
