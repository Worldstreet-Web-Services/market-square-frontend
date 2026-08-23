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
// Verification states include "pending" (request in review).
const VerificationSchema = z.enum(["none", "pending", "earned", "paid"]).catch("none");

const RawProfileSchema = z.object({
  id: z.string(),
  username: z.string().nullable().optional().default(null),
  displayName: z.string().nullable().optional().default(null),
  bio: z.string().nullable().optional().default(null),
  avatarUrl: z.string().nullable().optional().default(null),
  role: RoleSchema,
  verification: VerificationSchema,
  followerCount: z.number().optional().default(0),
  followingCount: z.number().optional().default(0),
  isFollowing: z.boolean().optional().default(false),
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
