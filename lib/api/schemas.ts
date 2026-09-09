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
  /**
   * The cover photograph behind the profile header — node 435:27500.
   *
   * Optional and nullable because the two environments disagree today: it is
   * on `PublicProfile` at `:8094` and NOT on the deployed spec, so a client
   * that required it would fail to parse every profile in production. When it
   * is absent the cover falls back to the seeded artwork, which is what
   * shipped before the field existed.
   */
  coverUrl: z.string().nullable().optional().default(null),
  /**
   * THE LINK ROW — node 545:47631 draws `akar-icons:link-chain` and a URL at
   * 15/20 under the place. LIVE on `PublicProfile` and `PATCH /me` at :8080
   * (null clears, absent leaves alone; the service accepts http(s) only).
   * Optional with a null default because the deployed spec lags :8080, as
   * `coverUrl` did. Rendered as an anchor only when it is an http(s) URL — the
   * client re-checks rather than trusting the write-side rule, because a
   * public page must never carry a `javascript:` href.
   */
  website: z.string().nullable().optional().default(null),
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
  /**
   * Whether this account has been through onboarding. PRIVATE — it is on
   * `GET /me` and deliberately absent from `PublicProfile`, because whether
   * somebody finished a product tour is nobody else's business.
   *
   * Defaulted TRUE, and the direction matters: absent means a payload that does
   * not carry the field, and the safe reading of that is "do not take over
   * somebody's screen". A missing field must never produce an onboarding flow.
   */
  hasOnboarded: z.boolean().optional().default(true),
  /*
    Self-declared place and gender — Explore's people filters.

    ON THE CONTRACT NOW, AND THE ENVIRONMENTS DISAGREE. `PublicProfile` carries
    city, region and gender at :8094, and does NOT on the deployed spec at
    api.tsionark.com — the PR that added them merged to staging while
    production deploys from main. So these stay optional with a null default:
    required, they would fail to parse every profile in production. That is the
    same forward-compatible shape `orgBadge` uses, and it is not a claim about
    which environment you are talking to.

    THE SHAPE IS THE SAFETY DECISION, and it is deliberate. City and region are
    STRINGS a person typed about themselves. There is no `latitude`, no
    `longitude`, no `distanceKm`, and there must never be one: a place somebody
    named is a fact they chose to publish, while a distance to a stranger is
    their position, recomputed every time you look. If a backend ever starts
    sending coordinates, this schema drops them on the floor — which is the
    correct outcome and the reason the fields are enumerated rather than passed
    through.
  */
  city: z.string().nullable().optional().default(null),
  region: z.string().nullable().optional().default(null),
  gender: z.string().nullable().optional().default(null),
  /*
    When this person was last seen, for the chat thread's "Active 20m ago".

    NULL IS A REAL ANSWER AND MUST STAY ONE. Presence is the field most often
    absent — a `ProfileSummary` embedded in a conversation may carry it while
    the same person's `PublicProfile` does not, and an account can legitimately
    have never been seen. `lastActiveLabel` returns null for a null, and the
    thread header then renders the handle alone rather than "Active recently",
    which would be a claim nobody made.
  */
  lastSeenAt: z.string().nullable().optional().default(null),
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
  /**
   * The transfer the buyer signed, once reported. Null until then, and null
   * forever on a ticket the rail settled server-side.
   */
  txHash: z.string().nullable().optional().default(null),
  /**
   * Where to send the money, on a deployment the BUYER settles.
   *
   * Present only when the service cannot move the money itself. Its presence
   * IS the instruction: a ticket that comes back carrying a wallet is not paid
   * for yet, and the buyer's own signature is what completes it.
   */
  toWallet: z.string().nullable().optional().default(null),
});

export const StreamSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  owner: ProfileSchema.nullable().optional().default(null),
  /**
   * WHO IS IN THE ROOM — a sample of up to three people currently connected,
   * host first, then the most recent joiners. GIST ROOMS ONLY, by the
   * backend's own privacy call: on a room you join, being seen is the point;
   * on a broadcast, the same field would publish who is WATCHING by name and
   * face to everyone, and nobody watching has been told they are visible.
   * Broadcasts carry no field at all.
   *
   * Two things a reader must not do with it: derive "and N others" from
   * `viewerCount` minus its length (presence counts SESSIONS, and a signed-out
   * viewer has no profile to resolve, so the sample is routinely shorter than
   * the count while a room is busy), and treat an empty array as "nobody is
   * here" (it can also mean nobody RESOLVABLE is here). Defaulted to empty so
   * a payload without it and a room without a resolvable soul render alike.
   */
  participants: z.array(ProfileSchema).optional().default([]),
  title: z.string(),
  description: z.string().nullable().optional().default(null),
  category: z.string().optional().default("other"),
  /**
   * Shared-vocabulary topic keys, as chosen in the composer. The service has
   * always returned them; the schema simply never modelled them, so the gist
   * room's invite card had no way to draw the topic chips node 225:3887 puts
   * on it. Defaulted to empty rather than optional — "no topics" and "this
   * payload does not carry topics" render identically here, and an array is
   * the shape every reader wants.
   */
  topics: z.array(z.string()).optional().default([]),
  /**
   * WHERE THIS ROOM BELONGS, and who may see it (migrations 039/041).
   *
   * `houseConversationId` is the house GROUP a gist room was opened from; it
   * feeds the room's own header ("Hacker House Maestros '26"), its partner
   * count and its House Members grid — all three read the same group. Null for
   * a room opened from the street, which belongs to no house.
   *
   * All optional with a default, the forward-compatible shape `orgBadge` uses:
   * a backend that has not shipped them parses exactly as it does today.
   */
  audience: z.enum(["public", "private"]).optional().default("public").catch("public"),
  houseConversationId: z.string().nullable().optional().default(null),
  /**
   * THE HOUSE GROUP THIS ROOM BELONGS TO, inline on the room.
   *
   * The room used to carry only `houseConversationId`, so naming the house
   * meant reading the CONVERSATION — which is membership-gated. The header
   * therefore worked only for people already inside, and "Join House" had
   * nothing to name for exactly the person it is aimed at.
   *
   * `viewerIsMember` is the whole decision: draw Join House or do not. It is
   * `false` for a signed-out reader too, so there is no third state to handle.
   * `visibility` decides whether joining is even possible —
   * `POST /conversations/:id/join` succeeds on a public group and refuses a
   * private one, so a private house shows the name without the invitation.
   *
   * A DOORPLATE, not a conversation: no roster, no messages, no last activity.
   * `GET /streams/:id` only — never on a list card, so nothing may build a grid
   * that expects it. Null when the room has no house, and null (not a 404) when
   * the house has been deleted.
   */
  house: z
    .object({
      id: z.string(),
      title: z.string().nullable().optional().default(null),
      imageUrl: z.string().nullable().optional().default(null),
      memberCount: z.number().nullable().optional().default(null),
      visibility: z.enum(["public", "private"]).optional().default("private").catch("private"),
      viewerIsMember: z.boolean().optional().default(false),
    })
    .nullable()
    .optional()
    .default(null),
  chatAccess: z.enum(["open", "followers"]).optional().default("open").catch("open"),
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
  /**
   * When the author last edited this post. Null means never.
   *
   * Every edit stamps it — there is no quiet window in which a post can change
   * without saying so — which is what makes it safe to render an "edited"
   * marker straight from the field rather than diffing anything.
   */
  editedAt: z.string().nullable().optional().default(null),
  likeCount: z.number(),
  commentCount: z.number(),
  repostCount: z.number().optional().default(0),
  /**
   * Distinct signed-in viewers. OPTIONAL with no default, because a
   * deployment whose service predates views must render nothing rather than a
   * confident "0 views" — "this payload has no view count" and "nobody has
   * watched this" are different claims, and printing the second for the first
   * is a lie the reader cannot detect.
   */
  viewCount: z.number().optional(),
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
  // Tips received. Both default so a backend without the columns still parses;
  // the card then simply shows no tally, which is honest.
  tipCount: z.number().optional().default(0),
  // Decimal string, KASH — never coerced to a number. Money that round-trips
  // through a float stops matching the ledger it came from.
  tipTotalKash: z.string().optional().default("0"),
  author: ProfileSchema.nullable().optional().default(null),
});

/**
 * What the server says about tipping before we draw the control.
 *
 * `enabled` is false whenever the payment rail cannot move KASH between two
 * users. We hide the button in that case rather than showing one that can only
 * return an error — an affordance that never works is worse than no affordance.
 */
export const TipCapabilitySchema = z.object({
  enabled: z.boolean(),
  /**
   * HOW a tip settles, and therefore what the client must do.
   *
   * `rail` — the service moves the money and the tip is confirmed by the time
   * the call returns. `client-signed` — the kash rail cannot pay a third
   * party (it exposes mint and burn and no transfer, and the platform is
   * non-custodial), so the SENDER signs a KSH transfer themselves and the tip
   * stays pending until the chain is observed.
   *
   * Defaulted to `rail` for a service that predates the field, because that is
   * what those deployments do. Treating an unknown value as client-signed
   * would leave the sender waiting to sign something nobody asked for.
   */
  settlement: z.enum(["rail", "client-signed"]).catch("rail").default("rail"),
  minKash: z.string(),
  maxKash: z.string(),
  verifiedAuthorsOnly: z.boolean(),
});

export type TipCapability = z.infer<typeof TipCapabilitySchema>;


export type Post = z.infer<typeof PostSchema>;

export type Mention = z.infer<typeof MentionSchema>;
