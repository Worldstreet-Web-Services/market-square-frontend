import { z } from "zod";
import { DeepLinkSchema, ProfileSchema } from "@/lib/api/schemas";

// The profile page's own compact view of the backend payloads. Kept local so
// this slice never reaches into feed or streams.

// GET /profiles/:username/posts returns FeedItems whose `post` embeds a
// hydrated author summary.
const ProfilePostSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  likeCount: z.number(),
  commentCount: z.number(),
  likedByMe: z.boolean().optional().default(false),
  deepLink: DeepLinkSchema.nullable().optional().default(null),
  author: ProfileSchema.nullable().optional().default(null),
});

const ProfileFeedItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  occurredAt: z.string(),
  post: ProfilePostSchema.nullable().optional().default(null),
});

export const ProfilePostsSchema = z
  .object({
    items: z.array(ProfileFeedItemSchema),
    nextCursor: z.string().nullable().optional().default(null),
  })
  .transform((page) => ({
    nextCursor: page.nextCursor,
    items: page.items.flatMap((item) => (item.post ? [item.post] : [])),
  }));

export const ProfileStreamSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  category: z.string().optional().default(""),
  scheduledAt: z.string().nullable().optional().default(null),
  ticketPriceKash: z.string().nullable().optional().default(null),
});

export const ProfileStreamsSchema = z.object({
  items: z.array(ProfileStreamSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const ProfileActivitySchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  startsAt: z.string(),
  status: z.string().optional().default("scheduled"),
  deepLink: DeepLinkSchema.nullable().optional().default(null),
});

export const ProfileActivitiesSchema = z.object({
  items: z.array(ProfileActivitySchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const FollowResultSchema = z.object({
  following: z.boolean(),
  followerCount: z.number(),
});

// Backend VerificationRule: { eligibility: { minFollowers,
// minParticipationScore }, paid: { priceKash }, economics: "proposed" }.
export const VerificationRuleSchema = z.object({
  status: z.enum(["draft", "approved"]).optional().default("draft"),
  eligibility: z
    .object({
      minFollowers: z.number().optional().default(0),
      minParticipationScore: z.number().optional().default(0),
    })
    .optional()
    .default({ minFollowers: 0, minParticipationScore: 0 }),
  paid: z.object({ priceKash: z.string() }).nullable().optional().default(null),
  economics: z.string().optional().default("proposed"),
});

// GET /me/verification → { current, latestRequest }.
export const MyVerificationSchema = z.object({
  current: z.enum(["none", "pending", "earned", "paid"]).catch("none"),
  latestRequest: z
    .object({
      id: z.string(),
      type: z.string(),
      status: z.enum(["pending", "approved", "rejected"]).catch("pending"),
      createdAt: z.string().optional().default(""),
    })
    .nullable()
    .optional()
    .default(null),
});

// Spotlight: weekly only; score is a decimal STRING.
export const SpotlightSchema = z.object({
  items: z.array(
    z.object({
      profile: ProfileSchema,
      score: z.string(),
      rank: z.number(),
    })
  ),
  computedAt: z.string().nullable().optional().default(null),
});

// POST /me/creator-application → application; GET → application | null.
export const CreatorApplicationSchema = z.object({
  id: z.string(),
  requestedRole: z.string().optional().default("creator"),
  status: z.enum(["pending", "approved", "rejected"]).catch("pending"),
  note: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});

export const MaybeCreatorApplicationSchema = CreatorApplicationSchema.nullable();

export type CreatorApplication = z.infer<typeof CreatorApplicationSchema>;

export type ProfilePost = z.infer<typeof ProfilePostSchema>;
export type ProfileStream = z.infer<typeof ProfileStreamSchema>;
export type ProfileActivity = z.infer<typeof ProfileActivitySchema>;
export type VerificationRule = z.infer<typeof VerificationRuleSchema>;
export type MyVerification = z.infer<typeof MyVerificationSchema>;
export type SpotlightBoard = z.infer<typeof SpotlightSchema>;
