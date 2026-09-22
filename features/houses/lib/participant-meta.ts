/**
 * Who a LiveKit participant actually IS.
 *
 * BACKEND B1. The brief's core loop is "tap a face, open a profile", and the
 * media plane is the only place a house learns that somebody is in the room —
 * an audience member has no speaker-request row, no chat message, nothing else
 * that names them. So the token has to carry the identity:
 *
 *   name     = displayName
 *   metadata = JSON.stringify({ username, avatarUrl, verification, orgBadge,
 *                               role, bio, isFollowing })
 *
 * on `POST /streams/:id/playback-token` and on go-live's `roomToken`.
 *
 * WITHOUT IT this returns null for everyone but ourselves, faces render as the
 * seeded `Avatar` under `participantLabel()`'s "Guest 4B2C", and a cell is a
 * button that opens what little we know rather than a link to a profile. The
 * room still works; the discovery loop does not. This is the highest-value
 * delta in the feature.
 *
 * Everything here treats the payload as HOSTILE. Metadata is set server-side
 * today, but it arrives over the media plane alongside packets that peers can
 * write, so nothing is trusted for its type, its length, or its scheme — an
 * `avatarUrl` of `javascript:…` would become an `<img src>` in front of the
 * whole room.
 *
 * Pure, no value imports. Pinned by lib/house-participant-meta.test.ts.
 */

/** Long enough for a real bio line, short enough that nobody can flood a row. */
const MAX_BIO = 200;
const MAX_NAME = 80;
const MAX_USERNAME = 64;
const MAX_URL = 2048;

const ROLES = ["citizen", "creator", "ambassador", "worldstreet"] as const;
const VERIFICATIONS = ["none", "pending", "verified", "lapsed"] as const;
const ORG_BADGES = ["market", "ark"] as const;

export type Verification = (typeof VERIFICATIONS)[number];

export interface ParticipantMeta {
  /** The handle a profile link is built from. Null when B1 has not shipped. */
  username: string | null;
  avatarUrl: string | null;
  /** One line under the name in the host's tray — what makes triage a decision. */
  bio: string;
  role: string;
  /** Narrowed here so the shared VerifiedBadge can take it without a cast. */
  verification: Verification;
  orgBadge: "market" | "ark" | null;
  /**
   * Whether the VIEWER follows this person.
   *
   * Optional and never defaulted, matching the app's rule elsewhere: undefined
   * means "this payload does not carry the follow edge", which is not the same
   * as "you do not follow them". The Porch's "who you follow inside" band and
   * the audience's PEOPLE YOU FOLLOW band are simply absent when it is missing,
   * rather than claiming an empty set.
   */
  isFollowing: boolean | undefined;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

/**
 * Only http(s) and data-less relative paths become an `<img src>`.
 *
 * Anything else — `javascript:`, `data:text/html`, a protocol-relative URL that
 * would fetch over plain http — is dropped and the seeded avatar is used
 * instead. A missing picture is nothing; a scheme we did not vet is an attack
 * surface pointed at every screen in the room.
 */
function safeUrl(value: unknown): string | null {
  const raw = str(value, MAX_URL);
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Parse a participant's metadata string.
 *
 * Returns null when there is nothing usable — an undeployed B1, an empty
 * string, malformed JSON, or a payload carrying no username. Null is the signal
 * every caller degrades on; it must never be papered over with an empty object,
 * because "we do not know who this is" and "this is a person with no name" need
 * to render differently.
 */
export function parseParticipantMeta(metadata: string | undefined | null): ParticipantMeta | null {
  if (!metadata) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;

  const username = str(record.username, MAX_USERNAME);
  // No handle means no profile to open, which is the only thing this metadata
  // is FOR. Everything else in the payload is garnish on a link that does not
  // exist.
  if (!username) return null;

  const bio = str(record.bio, MAX_BIO);
  return {
    username,
    avatarUrl: safeUrl(record.avatarUrl),
    bio: bio ?? "",
    role: oneOf(record.role, ROLES) ?? "citizen",
    verification: oneOf(record.verification, VERIFICATIONS) ?? "none",
    orgBadge: oneOf(record.orgBadge, ORG_BADGES),
    isFollowing: typeof record.isFollowing === "boolean" ? record.isFollowing : undefined,
  };
}

/** A display name from the token, capped. Falls through to participantLabel(). */
export function participantName(name: string | undefined | null): string | null {
  return str(name, MAX_NAME);
}
