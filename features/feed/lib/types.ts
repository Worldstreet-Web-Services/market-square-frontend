import { z } from "zod";
import { DeepLinkSchema, ProfileSchema } from "@/lib/api/schemas";

export const MentionSchema = z.object({
  type: z.enum(["profile", "group"]),
  id: z.string(),
  label: z.string(),
  handle: z.string(),
});

// Backend Post: author id plus a hydrated ProfileSummary on feed items.
// likedByMe comes from the backend on authed reads; the optimistic like
// cache is an overlay on that truth, reconciled on every refetch.
export const PostSchema = z.object({
  id: z.string(),
  authorId: z.string().optional().default(""),
  kind: z.enum(["update", "story"]).catch("update"),
  text: z.string(),
  mediaUrl: z.string().nullable().optional().default(null),
  // The backend now types its own media. Renderers prefer this over sniffing
  // the URL's extension; `isVideoPost` falls back to the sniff when absent.
  mediaKind: z.string().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  deepLink: DeepLinkSchema.nullable().optional().default(null),
  storyExpiresAt: z.string().nullable().optional().default(null),
  createdAt: z.string(),
  likeCount: z.number(),
  commentCount: z.number(),
  repostCount: z.number().optional().default(0),
  repostedByMe: z.boolean().optional().default(false),
  // The quoted original, hydrated one level deep only — a quote of a quote
  // shows the inner card's text, never a third nested frame. When the original
  // has been removed or expired the backend flags it rather than dropping the
  // field, so the card can say so instead of silently losing context.
  quotedPost: z.object({
    id: z.string(),
    text: z.string().optional().default(""),
    mediaUrl: z.string().nullable().optional().default(null),
    createdAt: z.string().optional().default(""),
    unavailable: z.boolean().optional().default(false),
    author: ProfileSchema.nullable().optional().default(null),
  }).nullable().optional().default(null),
  mentions: z.array(MentionSchema).optional().default([]),
  likedByMe: z.boolean().optional().default(false),
  // Arkmarks. Defaults to false so a backend that has not shipped the field
  // yet parses cleanly — the button reads "not saved" rather than throwing.
  bookmarkedByMe: z.boolean().optional().default(false),
  author: ProfileSchema.nullable().optional().default(null),
});

// Backend Comment carries only authorId — no hydrated author. The sheet
// falls back to a shortened id when author is absent.
export const CommentSchema = z.object({
  id: z.string(),
  authorId: z.string().optional().default(""),
  text: z.string(),
  createdAt: z.string(),
  author: ProfileSchema.nullable().optional().default(null),
});

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
