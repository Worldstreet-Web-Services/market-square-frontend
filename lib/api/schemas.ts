import { z } from "zod";

// Shapes shared across slices, mirroring the backend contract
// (GET /v1/market-square/openapi.json). A profile appears as a post author, a
// stream owner and a spotlight row, so its schema is cross-cutting.
//
// The backend allows null username/displayName/bio (a profile exists the
// moment Privy mints a DID); the transform normalizes those to render-safe
// strings once, at the boundary, so components never branch on null.

export const DeepLinkSchema = z.object({
  kind: z.string(),
  ref: z.string(),
});

// Backend roles: citizen | creator | ambassador | worldstreet.
const RoleSchema = z.enum(["citizen", "creator", "ambassador", "worldstreet"]).catch("citizen");
/**
 * Verification lifecycle.
 *
 * The platform GRANTS verification — nobody applies for it or buys in. Once
 * granted it is kept current by a recurring KASH payment; letting that lapse
 * pauses the badge without touching the underlying grant, so paying restores
 * it instantly with no re-approval.
 *
 * The silver check renders on `verified` ONLY. `lapsed` is a verified account
 * whose payment has run out, and it must not carry the check anywhere.
 */
const VerificationSchema = z.enum(["none", "pending", "verified", "lapsed"]).catch("none");
// The organisation badge is assigned admin-only and is NOT derived from role —
// product decides who carries one, so the two are independent signals that can
// appear together. `catch(null)` keeps an unknown future value from failing the
// parse, and the default keeps a backend without the field parsing cleanly.
const OrgBadgeSchema = z.enum(["market", "ark"]).nullable().catch(null);

const RawProfileSchema = z.object({
  id: z.string(),
  username: z.string().nullable().optional().default(null),
  displayName: z.string().nullable().optional().default(null),
  bio: z.string().nullable().optional().default(null),
  avatarUrl: z.string().nullable().optional().default(null),
  role: RoleSchema,
  verification: VerificationSchema,
  orgBadge: OrgBadgeSchema.optional().default(null),
  // Set by the service on GET /me for operator accounts. Presentation only —
  // every /admin route is enforced server-side, so hiding the UI is a courtesy
  // to non-admins, never the access control.
  isAdmin: z.boolean().optional().default(false),
  followerCount: z.number().optional().default(0),
  followingCount: z.number().optional().default(0),
  // Deliberately NOT defaulted. `undefined` means "this payload does not
  // carry the follow edge" — which is different from "you do not follow
  // them", and today `GET /spotlight` omits it entirely. Defaulting to false
  // erased that distinction and made every spotlight refetch stamp Follow
  // back over a follow the viewer had just made. Read it through
  // `useIsFollowing` (features/profile/lib/follow-state.ts), never raw, so an
  // absent field falls back to the session's own intent instead of a lie.
  isFollowing: z.boolean().optional(),
  isBlocked: z.boolean().optional().default(false),
});

// "Member ·A1B2" beats "Someone": derived from the tail of the Privy DID so
// two unnamed members are still distinguishable.
function placeholderName(id: string): string {
  const tail = id.replace(/^did:privy:/, "").slice(-4).toUpperCase();
  return tail ? `Member ·${tail}` : "New member";
}

export const ProfileSchema = RawProfileSchema.transform((p) => ({
  ...p,
  // True when the backend has no chosen username yet; the claim sheet keys
  // off this rather than string-sniffing the fallback.
  usernameUnclaimed: p.username === null,
  username: p.username ?? p.id,
  displayName: p.displayName ?? p.username ?? placeholderName(p.id),
  bio: p.bio ?? "",
}));

// PublicProfile and ProfileSummary both parse through ProfileSchema — the
// summary simply carries zero counts.
export type Profile = z.infer<typeof ProfileSchema>;
export type DeepLink = z.infer<typeof DeepLinkSchema>;
export type ProfileRole = z.infer<typeof RoleSchema>;
export type VerificationState = z.infer<typeof VerificationSchema>;
export type OrgBadge = z.infer<typeof OrgBadgeSchema>;


/**
 * Tickets and streams.
 *
 * These live here rather than in the streams slice because Explore renders
 * stream cards too, and slices never import each other. A type-only import
 * across that boundary is harmless at runtime, but keeping the shapes here
 * removes the temptation for someone to later add a VALUE import along the
 * same path. `StreamSchema` needs `TicketSchema`, so both moved together.
 */
export const TicketSchema = z.object({
  id: z.string(),
  streamId: z.string().optional().default(""),
  buyerId: z.string().optional().default(""),
  railRef: z.string().nullable().optional().default(null),
  tier: z.enum(["standard", "vip"]).catch("standard"),
  priceKash: z.string(),
  currency: z.string().optional().default("KASH"),
  status: z.enum(["pending", "confirmed", "failed", "refunded"]).catch("confirmed"),
  createdAt: z.string().optional().default(""),
  confirmedAt: z.string().nullable().optional().default(null),
});

export const StreamSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  owner: ProfileSchema.nullable().optional().default(null),
  title: z.string(),
  description: z.string().nullable().optional().default(null),
  category: z.string().optional().default("other"),
  // Ark broadcasts a casino game to Market Square as a stream, and carries the
  // way back into Ark here: { kind: "game", ref: "<game>:<id>" }. The service
  // has always sent this field; the schema dropped it, so the link never
  // reached the UI and those streams were dead ends.
  deepLink: DeepLinkSchema.nullable().optional().default(null),
  status: z.enum(["scheduled", "live", "ended", "cancelled"]).catch("scheduled"),
  visibility: z.enum(["public", "ticketed"]).catch("public"),
  ticketPriceKash: z.string().nullable().optional().default(null),
  vipPriceKash: z.string().nullable().optional().default(null),
  vipEarlyAccessMinutes: z.number().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  scheduledAt: z.string().nullable().optional().default(null),
  startedAt: z.string().nullable().optional().default(null),
  endedAt: z.string().nullable().optional().default(null),
  replayUrl: z.string().nullable().optional().default(null),
  refundPolicy: z.string().optional().default("Refunds are available when the host cancels before the stream begins."),
  replayPolicy: z.string().optional().default("Replay access follows the entitlement shown on your ticket."),
  peakViewers: z.number().optional().default(0),
  totalViewSeconds: z.number().optional().default(0),
  createdAt: z.string().optional().default(""),
  // StreamDetail addition, ABSENT on list rows — hence nullable, not 0.
  // Defaulting to 0 made "no live count available" indistinguishable from
  // "nobody is watching", and a discovery grid rendering a confident 0 (or
  // worse, a historical peak) is stating something untrue.
  viewerCount: z.number().nullable().optional().default(null),
  // Aggregate live reactions. Optional until all gateway deployments expose it.
  likeCount: z.number().optional().default(0),
  pulse: z.object({
    bullish: z.number().optional().default(0),
    neutral: z.number().optional().default(0),
    bearish: z.number().optional().default(0),
  }).optional().default({ bullish: 0, neutral: 0, bearish: 0 }),
  myTicket: TicketSchema.nullable().optional().default(null),
});

export type Ticket = z.infer<typeof TicketSchema>;
export type Stream = z.infer<typeof StreamSchema>;

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

export type Post = z.infer<typeof PostSchema>;
