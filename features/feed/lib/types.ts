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
   * THE THREAD FIELDS — asked of the backend on 2026-09-09, every one
   * optional with a default so today's payload (which carries none of them)
   * keeps parsing.
   *
   * `parentId` is the TOP-LEVEL comment this one answers, or null for a
   * top-level comment. One level only, the TikTok shape: a reply to a reply
   * carries the same top-level parent and names the person in its text, so a
   * thread never nests past two levels and never needs a recursive reader.
   *
   * `replyCount` is meaningful on a top-level comment (0 on a reply).
   * `likeCount` / `likedByMe` default to nothing-yet rather than being
   * absent, because the like control has to draw SOMETHING and "0, not liked"
   * is the honest zero state for a payload that cannot count.
   */
  parentId: z.string().nullable().optional().default(null),
  replyCount: z.number().optional().default(0),
  likeCount: z.number().optional().default(0),
  likedByMe: z.boolean().optional().default(false),
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
