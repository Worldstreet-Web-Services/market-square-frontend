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
  isFollowing: z.boolean().optional().default(false),
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
