import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPublicGet, isSafePath } from "./public-routes.ts";

/**
 * SOURCE OF TRUTH for this table: the backend's OpenAPI document. A GET is public when the spec lets an ANONYMOUS
 * caller make it. `security` is a list of ALTERNATIVES OR'd together, and an
 * EMPTY object is the alternative that requires nothing — so both a missing
 * `security` and `[{}, { bearerAuth: [] }]` mean public. The second shape is
 * "optional auth", which is what every public Market Square GET actually is:
 * it skips our session check but still forwards a token when there is one.
 * Only an array whose every alternative demands a scheme is secured.
 * See `GET ${WSAPI_BASE_URL}/v1/market-square/openapi.json`.
 *
 * TO RE-DERIVE when backend routes land:
 *
 *   curl -s "$WSAPI_BASE_URL/v1/market-square/openapi.json" \
 *     | jq -r '.paths | to_entries[]
 *              | .key as $p | .value | to_entries[]
 *              | select(.key == "get")
 *              | "\(if (.value.security // [{}]) | (length == 0 or any(length == 0))
 *                    then "PUBLIC" else "SECURED" end)\t\($p)"' \
 *     | sort
 *
 * Then update PUBLIC/SECURED below and `isPublicGet` to agree with it. Both
 * directions are asserted, so a route that becomes secured upstream fails here
 * just as loudly as one that becomes public — which is the point: the original
 * bug was an *over*-permission (`/streams/{id}/events` and `/stats` were being
 * forwarded unauthenticated), and a one-directional test would have missed it.
 *
 * Path ids below are placeholders; the predicate is purely structural and
 * never inspects id values.
 */

// Every GET the service publishes with NO security requirement (23 of them).
const PUBLIC: string[][] = [
  ["activities"],
  ["categories"],
  ["feed"],
  ["health"],
  ["openapi.json"],
  ["posts", "post_1"],
  ["posts", "post_1", "comments"],
  ["profiles", "adeey"],
  // The DIRECTORY collection. Explore's People tab is a discovery surface and
  // lists for signed-out visitors, with the sign-in invitation only on the
  // Follow action. The route is not in the backend spec yet, so the live
  // `check:public-routes` diff cannot catch it — which is precisely how
  // `categories`, `search` and `topics` each reached production gated at 401.
  ["profiles"],
  ["search"],
  ["topics"],
  ["profiles", "adeey", "posts"],
  ["profiles", "adeey", "streams"],
  ["profiles", "adeey", "activities"],
  ["profiles", "u_1", "followers"],
  ["profiles", "u_1", "following"],
  ["spotlight"],
  ["store", "items"],
  ["store", "items", "remit"],
  ["stories"],
  ["streams"],
  ["streams", "st_1"],
  ["streams", "st_1", "chat"],
  ["verification", "rule"],
];

// Every GET the service publishes BEHIND bearerAuth or adminKey (13 of them).
const SECURED: string[][] = [
  ["admin", "role-applications"],
  ["conversations", "cv_1", "messages"],
  ["me"],
  ["me", "bookmarks"],
  ["me", "conversations"],
  ["me", "creator-application"],
  ["me", "notifications"],
  ["me", "orders"],
  ["me", "tickets"],
  ["me", "unread"],
  ["me", "interests"],
  ["me", "verification"],
  ["streams", "st_1", "events"],
  ["streams", "st_1", "stats"],
];

/**
 * Path-traversal attempts. Next decodes segments, so `%2e%2e` reaches the
 * handler as `..`. Joined naively these normalise upstream into a DIFFERENT
 * service's route while the head still reads as an allowlisted one — which
 * would turn the BFF into an unauthenticated relay to any gateway path.
 */
const TRAVERSAL: string[][] = [
  ["streams", "x", "..", "..", "..", "kash", "balances"],
  ["streams", ".."],
  ["streams", "x", ".."],
  ["feed", "..", "..", "admin", "role-applications"],
  ["profiles", "..", "me"],
  ["store", "items", "..", "..", "me", "orders"],
  ["categories", "."],
  ["streams", "x/../../kash"],
  ["streams", "x\\..\\..\\kash"],
  ["feed", ""],
];

const show = (path: string[]) => `/${path.join("/")}`;

describe("isPublicGet", () => {
  describe("public GETs are readable signed out", () => {
    for (const path of PUBLIC) {
      it(show(path), () => {
        assert.equal(
          isPublicGet(path),
          true,
          `${show(path)} is public in the OpenAPI spec but isPublicGet gates it — ` +
            `signed-out visitors cannot reach it.`
        );
      });
    }
  });

  describe("secured GETs stay behind the session check", () => {
    for (const path of SECURED) {
      it(show(path), () => {
        assert.equal(
          isPublicGet(path),
          false,
          `${show(path)} requires auth in the OpenAPI spec but isPublicGet opens it — ` +
            `unauthenticated requests get forwarded upstream.`
        );
      });
    }
  });

  // The regression this table exists for: `head === "streams"` used to return
  // true for everything under /streams, so the two owner-only sub-resources
  // were forwarded without a session just to collect a 401 upstream.
  describe("regression: /streams is public except events and stats", () => {
    it("allows the list, the detail and chat", () => {
      assert.equal(isPublicGet(["streams"]), true);
      assert.equal(isPublicGet(["streams", "st_1"]), true);
      assert.equal(isPublicGet(["streams", "st_1", "chat"]), true);
    });

    it("gates events and stats", () => {
      assert.equal(isPublicGet(["streams", "st_1", "events"]), false);
      assert.equal(isPublicGet(["streams", "st_1", "stats"]), false);
    });
  });

  // The under-permission half: post permalinks and their comment threads are
  // public URLs, and were 401ing for signed-out visitors.
  describe("regression: post detail and comments are public", () => {
    it("allows the post and its comments", () => {
      assert.equal(isPublicGet(["posts", "post_1"]), true);
      assert.equal(isPublicGet(["posts", "post_1", "comments"]), true);
    });

    it("does not open anything else under /posts", () => {
      // These are writes, so the handler never consults the predicate for
      // them — but the predicate must not claim them either.
      assert.equal(isPublicGet(["posts", "post_1", "like"]), false);
      assert.equal(isPublicGet(["posts", "post_1", "repost"]), false);
      assert.equal(isPublicGet(["posts", "post_1", "bookmark"]), false);
      assert.equal(isPublicGet(["posts"]), false);
    });
  });

  describe("prefix matches do not leak", () => {
    it("gates /verification unless it is the rule", () => {
      assert.equal(isPublicGet(["verification", "rule"]), true);
      assert.equal(isPublicGet(["verification"]), false);
      assert.equal(isPublicGet(["verification", "requests"]), false);
    });

    it("gates unknown and empty paths", () => {
      assert.equal(isPublicGet([]), false);
      assert.equal(isPublicGet(["definitely-not-a-route"]), false);
    });
  });

  describe("path traversal is rejected", () => {
    for (const path of TRAVERSAL) {
      it(`isSafePath rejects ${show(path)}`, () => {
        assert.equal(
          isSafePath(path),
          false,
          `${show(path)} contains a traversal segment and must never be joined upstream.`
        );
      });

      it(`isPublicGet rejects ${show(path)}`, () => {
        // Belt and braces: even though the handler rejects these before the
        // allowlist runs, the allowlist must not vouch for them either.
        assert.equal(
          isPublicGet(path),
          false,
          `${show(path)} must not be treated as a public GET — its head only LOOKS allowlisted.`
        );
      });
    }

    it("accepts ordinary segments", () => {
      assert.equal(isSafePath(["streams", "st_1", "chat"]), true);
      assert.equal(isSafePath(["profiles", "adeey"]), true);
      // A dot inside a segment is fine — only a bare "." or ".." is not.
      assert.equal(isSafePath(["profiles", "first.last"]), true);
      assert.equal(isSafePath(["openapi.json"]), true);
    });
  });

  // The streams rule used to match on the head alone, which vouched for every
  // sub-resource under /streams — including the two owner-only ones.
  describe("regression: /streams matches exact shapes, not a head prefix", () => {
    it("allows exactly the list, the detail and chat", () => {
      assert.equal(isPublicGet(["streams"]), true);
      assert.equal(isPublicGet(["streams", "st_1"]), true);
      assert.equal(isPublicGet(["streams", "st_1", "chat"]), true);
    });

    it("gates every other shape under /streams", () => {
      assert.equal(isPublicGet(["streams", "st_1", "events"]), false);
      assert.equal(isPublicGet(["streams", "st_1", "stats"]), false);
      assert.equal(isPublicGet(["streams", "st_1", "tickets"]), false);
      assert.equal(isPublicGet(["streams", "st_1", "heartbeat"]), false);
      assert.equal(isPublicGet(["streams", "st_1", "chat", "msg_1"]), false);
      assert.equal(isPublicGet(["streams", "st_1", "chat", "msg_1", "extra"]), false);
    });
  });

  it("has no path in both tables", () => {
    const secured = new Set(SECURED.map(show));
    const overlap = PUBLIC.map(show).filter((path) => secured.has(path));
    assert.deepEqual(overlap, [], "a path cannot be both public and secured");
  });
});
