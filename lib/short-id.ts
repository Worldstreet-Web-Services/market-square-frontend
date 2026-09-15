/**
 * SHORT POST IDS — the 22-character form a post is SHARED as.
 *
 * A post id is a UUID, and `/p/01a0a16c-bcad-7000-882e-673a9416f9b2` is 39
 * characters of hex and dashes in the middle of somebody's WhatsApp message.
 * The same 128 bits written in base62 are 22 characters, so the shared link is
 * `/p/034OqIADSAafQwmr157BHm` and nothing about the post changes: the route
 * turns it back into the UUID before anything asks the service for it.
 *
 * THE PARAM IS HOSTILE INPUT. Next decodes a segment before we see it, so
 * `%2E%2E` arrives as `..`, and a metadata fetch never passes through the
 * BFF's `isSafePath`. Everything here is therefore an ALLOWLIST: a UUID shape,
 * or exactly 22 alphabet characters — nothing else resolves, and nothing is
 * ever decoded a second time.
 *
 * ONE SPELLING PER POST. A value is accepted only if encoding it again gives
 * back the same string, so leading-zero or out-of-range variants cannot become
 * a second address for the same post (or a cache key nobody meant).
 *
 * Pure and dependency-free, so `node --test` pins it.
 */

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BigInt(ALPHABET.length);
/** 62^22 ≈ 2^131, so 22 characters always hold 128 bits. */
export const SHORT_ID_LENGTH = 22;
const MAX = 1n << 128n;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_RE = /^[0-9A-Za-z]{22}$/;

/** Is this a UUID (any version, either case)? */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** UUID → 22-character base62. Null for anything that is not a UUID. */
export function toShortId(uuid: string): string | null {
  if (!isUuid(uuid)) return null;
  let value = BigInt(`0x${uuid.replace(/-/g, "")}`);
  let out = "";
  while (value > 0n) {
    out = ALPHABET[Number(value % BASE)] + out;
    value /= BASE;
  }
  return out.padStart(SHORT_ID_LENGTH, ALPHABET[0]);
}

/** 22-character base62 → canonical lowercase dashed UUID, or null. */
export function fromShortId(short: string): string | null {
  if (!SHORT_RE.test(short)) return null;
  let value = 0n;
  for (const char of short) value = value * BASE + BigInt(ALPHABET.indexOf(char));
  if (value >= MAX) return null;
  const hex = value.toString(16).padStart(32, "0");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  // Only the canonical spelling resolves.
  return toShortId(uuid) === short ? uuid : null;
}

export interface ResolvedPostParam {
  /** What the service and every API call receive. Always lowercase. */
  uuid: string;
  /** What the post is shared and canonicalised as. */
  shortId: string;
}

/**
 * A post id in the FIXTURE data (`lib/fixtures`): `p_dre_win`, `p_zara_promo`.
 * Lowercase letters, digits and underscores after `p_` — nothing that can
 * spell a path, a dot or a separator.
 */
const FIXTURE_POST_ID = /^p_[a-z0-9_]{1,60}$/;

export interface ResolvePostParamOptions {
  /**
   * Accept fixture ids too. ONLY when there is no upstream service
   * (`WSAPI_BASE_URL` unset): the whole app then demos from `lib/fixtures`,
   * whose posts are not UUIDs, and without this every post page 404'd. With a
   * real service configured these ids are never valid, so they stay refused —
   * and they never reach an upstream URL either way, because a metadata read
   * only ever fetches a UUID.
   */
  fixtureIds?: boolean;
}

/**
 * `/p/[id]`'s param, either spelling, or null. The caller treats null as a
 * 404 and must never fall back to using the raw param.
 */
export function resolvePostParam(param: string, options: ResolvePostParamOptions = {}): ResolvedPostParam | null {
  if (options.fixtureIds && FIXTURE_POST_ID.test(param)) return { uuid: param, shortId: param };
  if (isUuid(param)) {
    const uuid = param.toLowerCase();
    const shortId = toShortId(uuid);
    return shortId ? { uuid, shortId } : null;
  }
  const uuid = fromShortId(param);
  return uuid ? { uuid, shortId: param } : null;
}

/**
 * The id to put in a SHARED post link: the short form when the post has a
 * UUID, the id unchanged when it does not (a link the route would refuse is
 * still better than a share sheet that throws).
 */
export function sharePostId(postId: string): string {
  return toShortId(postId) ?? postId;
}
