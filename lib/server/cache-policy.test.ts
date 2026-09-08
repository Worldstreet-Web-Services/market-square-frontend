import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cacheControlFor, PRIVATE_CACHE, PUBLIC_CACHE } from "./cache-policy.ts";

const anon = { method: "GET", status: 200, isPublic: true, hasAuthorization: false };

describe("BFF cache policy", () => {
  it("lets an anonymous public GET be shared-cached", () => {
    assert.equal(cacheControlFor(anon), PUBLIC_CACHE);
  });

  it("NEVER shared-caches a request that carried credentials", () => {
    /*
      The one that matters. Public GETs still forward a caller's token, so
      `/feed` answers the SAME URL with a different body per reader —
      `likedByMe`, `bookmarkedByMe`. Caching on route shape alone would serve
      one reader another reader's likes.
    */
    assert.equal(cacheControlFor({ ...anon, hasAuthorization: true }), PRIVATE_CACHE);
  });

  it("never shared-caches a gated route, credentials or not", () => {
    assert.equal(cacheControlFor({ ...anon, isPublic: false }), PRIVATE_CACHE);
    assert.equal(
      cacheControlFor({ ...anon, isPublic: false, hasAuthorization: true }),
      PRIVATE_CACHE
    );
  });

  it("never shared-caches a write", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      assert.equal(cacheControlFor({ ...anon, method }), PRIVATE_CACHE);
    }
  });

  it("never caches a non-200 — an error must not be served to the next reader", () => {
    for (const status of [204, 301, 400, 401, 404, 429, 500, 502]) {
      assert.equal(cacheControlFor({ ...anon, status }), PRIVATE_CACHE);
    }
  });

  it("always answers with an explicit directive, never silence", () => {
    // Silence is heuristically cacheable, which is how an inbox ends up in a
    // shared cache. Every path must name a policy.
    for (const method of ["GET", "POST"]) {
      for (const isPublic of [true, false]) {
        for (const hasAuthorization of [true, false]) {
          const value = cacheControlFor({ method, status: 200, isPublic, hasAuthorization });
          assert.ok(value && value.length > 0);
        }
      }
    }
  });
});
