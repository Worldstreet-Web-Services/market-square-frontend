/**
 * WHAT THE BFF LETS ANYONE ELSE CACHE.
 *
 * The proxy set no `Cache-Control` at all. That is two problems, not one:
 *
 *  1. SCALE. Every poll of a public, identical-for-everyone list travelled all
 *     the way to the service. At 20k concurrent tabs the Home live lane alone
 *     is ~660 req/s of byte-identical answers.
 *  2. CORRECTNESS. A response with no cache directive is HEURISTICALLY
 *     cacheable — an intermediary is allowed to guess a freshness lifetime.
 *     The bodies here include somebody's inbox. Silence is the dangerous
 *     answer; the safe one has to be said out loud.
 *
 * ─── THE ONE RULE ───────────────────────────────────────────────────────────
 * A response may be shared-cached ONLY when it cannot be about a person: a GET,
 * on a route `isPublicGet` allows, with NO Authorization header on the request,
 * answering 200.
 *
 * THE AUTHORIZATION CHECK IS THE LOAD-BEARING ONE, and it is not the same as
 * "the route is public". Public GETs still FORWARD a caller's token when one is
 * present, so `/feed` comes back carrying `likedByMe` and `bookmarkedByMe` for
 * that reader — the same URL, a different body per person. Caching on route
 * shape alone would hand one reader another reader's likes. Anonymous is the
 * only state in which a public route's body is genuinely the same for everyone.
 *
 * Everything else is `private, no-store`: said explicitly rather than left to a
 * heuristic.
 */
export interface CachePolicyInput {
  method: string;
  status: number;
  /** Whether `isPublicGet` allows this path — the route's own shape. */
  isPublic: boolean;
  /** Whether the CALLER sent credentials, which personalises a public route. */
  hasAuthorization: boolean;
}

/**
 * 30s of shared freshness, then two minutes of stale-while-revalidate.
 *
 * Short enough that a live list is never meaningfully behind — the clients
 * polling these ask every 30s anyway, so this collapses N identical upstream
 * calls into one without making anybody's view older than it already was.
 * `stale-while-revalidate` is what keeps a cold revalidation off the reader's
 * critical path.
 */
export const PUBLIC_CACHE = "public, s-maxage=30, stale-while-revalidate=120";
export const PRIVATE_CACHE = "private, no-store";

export function cacheControlFor(input: CachePolicyInput): string {
  if (input.method !== "GET") return PRIVATE_CACHE;
  if (input.status !== 200) return PRIVATE_CACHE;
  if (!input.isPublic) return PRIVATE_CACHE;
  if (input.hasAuthorization) return PRIVATE_CACHE;
  return PUBLIC_CACHE;
}
