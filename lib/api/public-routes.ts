/**
 * Which Market Square GETs a signed-out visitor may read.
 *
 * SOURCE OF TRUTH: the backend's own OpenAPI document. A GET is public exactly
 * when its operation carries no `security` requirement in
 * `GET ${WSAPI_BASE_URL}/v1/market-square/openapi.json`.
 *
 * TO RE-DERIVE after backend routes land, run:
 *
 *   curl -s "$WSAPI_BASE_URL/v1/market-square/openapi.json" \
 *     | jq -r '.paths | to_entries[]
 *              | .key as $p | .value | to_entries[]
 *              | select(.key == "get")
 *              | "\(if (.value.security // []) | length == 0
 *                    then "PUBLIC" else "SECURED" end)\t\($p)"' \
 *     | sort
 *
 * then reconcile this predicate and the table in `public-routes.test.ts`
 * against that output. The test asserts both directions, so an entry that
 * drifts either way fails CI rather than rotting silently.
 *
 * This module is deliberately dependency-free: the route handler imports it,
 * and so does the test, without dragging in `next/server` or Privy.
 *
 * Note that a public GET only skips *our* session check — the caller's token
 * is still forwarded when present, so personalised fields (`likedByMe`,
 * `bookmarkedByMe`) keep resolving for signed-in readers.
 */
export function isPublicGet(path: string[]): boolean {
  const [head, second, third] = path;

  // Public in their entirety.
  if (head === "feed" || head === "stories" || head === "spotlight") return true;
  if (head === "activities") return true;
  // The category index feeds the right rail, which renders signed out.
  if (head === "categories") return true;
  // Every GET under /profiles is public: the profile itself, its posts,
  // streams and activities, and both follow lists.
  if (head === "profiles") return true;
  // /store/items and /store/items/{slug}.
  if (head === "store") return true;
  if (head === "health" || head === "openapi.json") return true;

  // /posts/{id} and /posts/{id}/comments only. Every other posts route (like,
  // repost, bookmark) is a write and never reaches this predicate.
  if (head === "posts" && second) {
    return path.length === 2 || (path.length === 3 && third === "comments");
  }

  // Stream list, detail and chat reads are public — but /streams/{id}/events
  // and /streams/{id}/stats are owner-only (bearerAuth), so they stay behind
  // the session check instead of being forwarded upstream to collect a 401.
  if (head === "streams") {
    return !(path.length === 3 && (third === "events" || third === "stats"));
  }

  if (head === "verification" && second === "rule") return true;

  return false;
}
