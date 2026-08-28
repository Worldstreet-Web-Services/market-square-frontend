import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueryClient } from "@tanstack/react-query";
import {
  invalidateContentSurfaces,
  invalidateIdentitySurfaces,
  patchFollowInData,
} from "./invalidate.ts";

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

/**
 * The bug: Explore's People rows carry `isFollowing`, which by design
 * outranks the session intent — so a click that did not rewrite the cached
 * row left the button reading "Follow".
 */
describe("patchFollowInData", () => {
  it("flips a bare profile row and moves its follower count", () => {
    const data = { pages: [{ items: [{ id: "a", isFollowing: false, followerCount: 3 }] }] };
    const next = patchFollowInData(data, "a", true) as typeof data;
    assert.deepEqual(next.pages[0]?.items[0], { id: "a", isFollowing: true, followerCount: 4 });
  });

  it("reaches a profile nested under a search result", () => {
    const data = { items: [{ kind: "profile", id: "r1", profile: { id: "a", isFollowing: false } }] };
    const next = patchFollowInData(data, "a", true) as typeof data;
    assert.equal(next.items[0]?.profile.isFollowing, true);
  });

  it("leaves other people, and a row without the field, alone", () => {
    const data = { items: [{ id: "b", isFollowing: false }, { id: "a", displayName: "A" }] };
    assert.equal(patchFollowInData(data, "a", true), data);
  });

  it("never drives a follower count below zero", () => {
    const data = { items: [{ id: "a", isFollowing: true, followerCount: 0 }] };
    const next = patchFollowInData(data, "a", false) as typeof data;
    assert.equal(next.items[0]?.followerCount, 0);
  });
});
