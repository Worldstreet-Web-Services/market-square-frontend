import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateContentSurfaces, invalidateIdentitySurfaces } from "./invalidate.ts";

/**
 * These lists are the fix for a whole class of stale-cache bug: identity
 * (name, avatar, verified check, org badge, role chip) is COPIED into feed
 * items, story groups, search results, conversation previews and spotlight
 * rows rather than read from the profile query, so a mutation that invalidates
 * only `["ms","profile"]` leaves the old value on every other surface.
 *
 * The failure mode is nearly invisible in review — a badge that is stale
 * somewhere unrelated — so the required keys are pinned here. Removing one
 * fails this test rather than silently regressing the app.
 */
function recordKeys(run: (client: QueryClient) => void): string[] {
  const seen: string[] = [];
  const stub = {
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      seen.push((queryKey as string[]).join("/"));
    },
  } as unknown as QueryClient;
  run(stub);
  return seen;
}

describe("invalidateIdentitySurfaces", () => {
  const REQUIRED = [
    "ms/profile",
    "ms/profile-posts",
    "ms/feed",
    "ms/stories",
    "ms/spotlight",
    "ms/discovery",
    "ms/conversations",
    "ms/bookmarks",
  ];

  const invalidated = recordKeys(invalidateIdentitySurfaces);

  for (const key of REQUIRED) {
    it(`invalidates ${key}`, () => {
      assert.ok(
        invalidated.includes(key),
        `${key} renders somebody's identity, so it must be invalidated when a ` +
          `name, avatar, verification or org badge changes — otherwise it keeps ` +
          `showing the old one until it happens to refetch.`
      );
    });
  }

  it("invalidates each key exactly once", () => {
    assert.equal(new Set(invalidated).size, invalidated.length);
  });
});

describe("invalidateContentSurfaces", () => {
  // Removing a post has to empty it out of every list already holding a copy.
  const REQUIRED = ["ms/feed", "ms/bookmarks", "ms/profile-posts"];

  const invalidated = recordKeys(invalidateContentSurfaces);

  for (const key of REQUIRED) {
    it(`invalidates ${key}`, () => {
      assert.ok(
        invalidated.includes(key),
        `${key} holds a copy of post content, so removing a post must invalidate it.`
      );
    });
  }
});
