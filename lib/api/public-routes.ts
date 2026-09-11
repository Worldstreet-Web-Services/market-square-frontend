/**
 * Which Market Square GETs a signed-out visitor may read.
 *
 * SOURCE OF TRUTH: the backend's own OpenAPI document. A GET is public when the spec lets an ANONYMOUS
 * caller make it. `security` is a list of ALTERNATIVES OR'd together, and an
 * EMPTY object is the alternative that requires nothing — so both a missing
 * `security` and `[{}, { bearerAuth: [] }]` mean public. The second shape is
 * "optional auth", which is what every public Market Square GET actually is:
 * it skips our session check but still forwards a token when there is one.
 * Only an array whose every alternative demands a scheme is secured.
 * See `GET ${WSAPI_BASE_URL}/v1/market-square/openapi.json`.
 *
 * TO RE-DERIVE after backend routes land, run:
 *
 *   curl -s "$WSAPI_BASE_URL/v1/market-square/openapi.json" \
 *     | jq -r '.paths | to_entries[]
 *              | .key as $p | .value | to_entries[]
 *              | select(.key == "get")
 *              | "\(if (.value.security // [{}]) | (length == 0 or any(length == 0))
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
/**
 * Is every segment safe to join into an upstream URL?
 *
 * Next hands us decoded segments, so `%2e%2e` arrives as `..`. Joining those
 * lets `/streams/x/../../../kash/balances` normalise upstream into a DIFFERENT
 * service's route while `isPublicGet` still sees head === "streams" — turning
 * the BFF into an unauthenticated relay to any gateway path. Reject the whole
 * request rather than trying to sanitise it.
 */
export function isSafePath(path: string[]): boolean {
  return path.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      !segment.includes("/") &&
      !segment.includes("\\")
  );
}

export function isPublicGet(path: string[]): boolean {
  // A traversal attempt is never public, whatever its head looks like.
  if (!isSafePath(path)) return false;

  const [head, second, third] = path;

  // Public in their entirety.
  if (head === "feed" || head === "stories" || head === "spotlight") return true;
  if (head === "activities") return true;
  // The category index feeds the right rail, which renders signed out.
  if (head === "categories") return true;
  // Every GET under /profiles is public: the DIRECTORY collection itself, one
  // profile, its posts, streams and activities, and both follow lists. The
  // collection matters — Explore's People tab is a discovery surface and has
  // to list for signed-out visitors, with the sign-in invitation only on the
  // Follow action.
  if (head === "profiles") return true;
  // /store/items and /store/items/{slug}.
  if (head === "store") return true;
  if (head === "health" || head === "openapi.json") return true;
  // Search is public; an optional token only enriches viewer state.
  if (head === "search") return true;
  // The topic vocabulary is public — the picker renders for signed-out
  // visitors too, who choose first and are prompted to sign in to save.
  if (head === "topics") return true;

  // /posts/{id} and /posts/{id}/comments only. Every other posts route (like,
  // repost, bookmark) is a write and never reaches this predicate.
  if (head === "posts" && second) {
    return path.length === 2 || (path.length === 3 && third === "comments");
  }
  // One comment, and a thread's replies, read like the comments they hang
  // under: public with optional auth, so `likedByMe` resolves for a signed-in
  // reader. `/replies` is documented so; `GET /comments/{id}` answers 200 to
  // an anonymous curl on :8080 (2026-09-09) while the spec document has not
  // caught up with it — see PENDING_ROUTES.
  if (head === "comments" && second) {
    return path.length === 2 || (path.length === 3 && third === "replies");
  }

  // Stream reads are public at three EXACT shapes only: the list, one stream,
  // and its chat. Matching on the head alone let anything under /streams
  // through — including owner-only sub-resources and, before `isSafePath`,
  // traversal out of the namespace entirely.
  if (head === "streams") {
    if (path.length === 1) return true;
    if (path.length === 2) return true;
    return path.length === 3 && third === "chat";
  }

  if (head === "verification" && second === "rule") return true;

  // The PUBLIC HOUSE DIRECTORY, and only that exact shape. Home's "Join a
  // community" grid renders for signed-out visitors, so gating it would give
  // them a 401 on content the service serves to anyone who asks — the same
  // failure `categories`, `search` and `topics` each shipped with. Every other
  // /conversations route needs a session and stays behind the predicate below:
  // this one answers for people who are not members, and it deliberately
  // carries no message, unread count or last activity.
  if (head === "conversations" && second === "discover" && path.length === 2) return true;

  // What a house INVITE LINK opens onto — `GET /invites/:token`, optional auth.
  // The link is sent to people who are not members and often not signed in,
  // and the landing page has to show them the house before asking either. Only
  // this exact shape; accepting is a POST and never reaches this predicate.
  if (head === "invites" && second && path.length === 2) return true;

  // The trending hashtag rail. Public upstream and public here: it is a
  // DISCOVERY surface that renders for signed-out visitors, and gating it gave
  // them a 401 on content the service was serving to anyone who asked. Only
  // this exact shape — every other /hashtags route stays behind the predicate
  // below.
  if (head === "hashtags" && second === "trending" && path.length === 2) return true;

  // The tip capability probe, and only that exact shape. A signed-out reader
  // has to see the same tip control a signed-in one does, so the sign-in
  // prompt lands when they choose to pay rather than when they merely look.
  // /me/tips/received is earnings and is NOT here — it needs a session.
  if (head === "tips" && second === "capability" && path.length === 2) return true;

  // The upload contract (caps + content-type allowlist). Public upstream, and
  // it has to be public here too: the composer's file picker and its size
  // pre-check render for signed-out visitors, and a 401 would silently pin
  // them to our compiled-in fallback numbers — the exact drift the endpoint
  // exists to remove. Only this EXACT shape; every other /uploads route is a
  // POST and never reaches this predicate.
  if (head === "uploads" && second === "limits" && path.length === 2) return true;

  return false;
}
