import { z } from "zod";
import { DeepLinkSchema, ProfileSchema, MentionSchema, PostSchema } from "@/lib/api/schemas";

// The post shape lives in lib/api/schemas so the profile slice can parse the
// same one. Slices never import each other, and profile previously carried a
// compact copy that dropped the media, the arkmark and the repost, which is
// why a post on a profile could not be liked and did not look like a post.
export { MentionSchema, PostSchema };

// Backend Comment carries only authorId — no hydrated author. The sheet
// falls back to a shortened id when author is absent.
export const CommentSchema = z.object({
  id: z.string(),
  postId: z.string().optional().default(""),
  authorId: z.string().optional().default(""),
  text: z.string(),
  createdAt: z.string(),
  author: ProfileSchema.nullable().optional().default(null),
  /**
   * THE THREAD FIELDS — the backend's final shape, live on :8080 2026-09-09.
   *
   * `parentId` is the TOP-LEVEL comment this one sits under, null on a
   * top-level comment. The tree is one level deep and the SERVER keeps it so:
   * a reply is posted with the TAPPED comment's id as `parentId`, and when
   * that comment is itself a reply the service files the new one under the
   * top-level parent and records who was answered in `replyToCommentId` and
   * `replyTo`. The client never resolves the top-level parent itself.
   *
   * `replyTo` is the answered person, RESOLVED — the "@username" a reply
   * opens with comes from this field and never from parsing the text. Null
   * when the reply answered the parent directly or the account is gone, and
   * then there is no prefix at all rather than a blank mention.
   *
   * `likedByMe` is OMITTED for an anonymous reader, never sent as false —
   * the same rule as `isFollowing`. So it has no default: undefined means
   * "nobody was asked", and the heart draws it as not-yet-liked without
   * claiming a checked answer.
   */
  parentId: z.string().nullable().optional().default(null),
  replyToCommentId: z.string().nullable().optional().default(null),
  replyTo: ProfileSchema.nullable().optional().default(null),
  replyCount: z.number().optional().default(0),
  likeCount: z.number().optional().default(0),
  likedByMe: z.boolean().optional(),
});

/** `POST|DELETE /comments/:id/like` — the resulting state, same shape as a post like. */
export const CommentLikeResultSchema = z.object({ liked: z.boolean(), likeCount: z.number() });

// The feed's view of a backend Stream: no owner object, no live viewerCount
// (that's detail-only) — peakViewers is what the list carries.
export const FeedStreamSchema = z.object({
  id: z.string(),
  ownerId: z.string().optional().default(""),
  title: z.string(),
  category: z.string().optional().default(""),
  status: z.string(),
  visibility: z.string().optional().default("public"),
  ticketPriceKash: z.string().nullable().optional().default(null),
  vipPriceKash: z.string().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  peakViewers: z.number().optional().default(0),
  scheduledAt: z.string().nullable().optional().default(null),
  owner: ProfileSchema.nullable().optional().default(null),
});

export const FeedActivitySchema = z.object({
  id: z.string(),
  hostId: z.string().optional().default(""),
  type: z.string(),
  title: z.string(),
  description: z.string().nullable().optional().default(null),
  startsAt: z.string(),
  status: z.string().optional().default("scheduled"),
  deepLink: DeepLinkSchema.nullable().optional().default(null),
  owner: ProfileSchema.nullable().optional().default(null),
});

export const PlatformEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().nullable().optional().default(null),
  occurredAt: z.string(),
});

export const FeedItemSchema = z.object({
  id: z.string(),
  type: z.enum(["post", "stream", "activity", "platform_event"]),
  occurredAt: z.string(),
  // Present when the item reaches the viewer through someone's repost: the
  // original post, attributed to whoever passed it on.
  repostedBy: ProfileSchema.nullable().optional().default(null),
  deepLink: DeepLinkSchema.nullable().optional().default(null),
  post: PostSchema.nullable().optional().default(null),
  stream: FeedStreamSchema.nullable().optional().default(null),
  activity: FeedActivitySchema.nullable().optional().default(null),
  platformEvent: PlatformEventSchema.nullable().optional().default(null),
});

export const FeedPageSchema = z.object({
  items: z.array(FeedItemSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const CommentsPageSchema = z.object({
  items: z.array(CommentSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const LikeResultSchema = z.object({ liked: z.boolean(), likeCount: z.number() });
// POST/DELETE /posts/:id/bookmark. The backend contract returns the resulting
// state; older builds answer with an empty body, hence the optional field.
export const BookmarkResultSchema = z.object({
  bookmarked: z.boolean().optional(),
});
export const RepostResultSchema = z.object({ reposted: z.boolean(), repostCount: z.number() });

// Backend report reasons are a fixed enum.
export const ReportReasonSchema = z.enum(["spam", "abuse", "scam", "other"]);

export type Post = z.infer<typeof PostSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type FeedStream = z.infer<typeof FeedStreamSchema>;
export type FeedPage = z.infer<typeof FeedPageSchema>;
export type ReportReason = z.infer<typeof ReportReasonSchema>;
export type Mention = z.infer<typeof MentionSchema>;
export type Lane = "for-you" | "following" | "live" | "platform" | "reels" | "trending";
