import { z } from "zod";
import { DeepLinkSchema, PostSchema, ProfileSchema } from "@/lib/api/schemas";

// The profile page's own compact view of the backend payloads. Kept local so
// this slice never reaches into feed or streams.

// GET /profiles/:username/posts returns FeedItems whose `post` embeds a
// hydrated author summary.
//
// It parses the SHARED post shape, not a local subset. The compact copy that
// used to live here dropped the media, the arkmark, the repost and the quote,
// so a post read differently on a profile than anywhere else and could not be
// rendered by the real card. The backend returns the whole post either way.
const ProfilePostSchema = PostSchema;

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
  // What the Replays rail (545:47746) draws on an ended gist room: its topics,
  // when it ended, the host's face, and whether a recording exists. All
  // optional with defaults — the payload has always carried them, the compact
  // schema simply never read them.
  topics: z.array(z.string()).optional().default([]),
  endedAt: z.string().nullable().optional().default(null),
  replayUrl: z.string().nullable().optional().default(null),
  owner: ProfileSchema.nullable().optional().default(null),
});

/**
 * `GET /profiles/:username/streams` filters — LIVE on :8080 (measured on
 * prince: unfiltered 7, `kind=room` 4, `status=ended&kind=room` 3). `kind` is
 * `broadcast | room`, NOT `house`: the route names the gist room by what it
 * is, not by the category value that stores it.
 */
export interface ProfileStreamFilters {
  status?: "live" | "scheduled" | "ended";
  kind?: "broadcast" | "room";
}

/**
 * A BADGE — `GET /profiles/:username/badges` (asked; not on the contract yet).
 *
 * `earnedAt` null is LOCKED: the panel on your own profile (543:40148) draws
 * the whole catalogue with the locked ones dimmed behind a lock, a stranger's
 * section (545:47637) draws only what they have earned. `key` selects the
 * artwork; `name` and `description` are the service's words, never ours.
 */
export const BadgeSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional().default(null),
  earnedAt: z.string().nullable().optional().default(null),
});
export type Badge = z.infer<typeof BadgeSchema>;

export const ProfileBadgesSchema = z.object({
  items: z.array(BadgeSchema),
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

/**
 * GET /me/verification — the owner's billing view of their own badge.
 *
 * Billing dates live ONLY here. They are never present on a public profile, so
 * no surface may render another user's renewal state.
 *
 * `latestRequest` survives for legacy pending records only: verification is
 * granted by the platform now, so nothing new is ever requested.
 */
export const MyVerificationSchema = z.object({
  status: z.enum(["none", "pending", "verified", "lapsed"]).catch("none"),
  verifiedSince: z.string().nullable().optional().default(null),
  paidThrough: z.string().nullable().optional().default(null),
  daysRemaining: z.number().nullable().optional().default(null),
  // KASH is a decimal string end to end.
  priceKash: z.string().optional().default("0"),
  periodDays: z.number().optional().default(30),
  trialDays: z.number().optional().default(30),
  canRenew: z.boolean().optional().default(false),
  economics: z.string().optional().default(""),
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

// POST /me/verification/renew → the refreshed billing view.
export const RenewVerificationSchema = MyVerificationSchema;

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
