import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  invalidateContentSurfaces,
  invalidateIdentitySurfaces,
  patchBlockInCaches,
  patchBlockInData,
  patchFollowInCaches,
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

/**
 * The block patch, which is a SAFETY guarantee and not a label refresh.
 *
 * Explore's people cards carry a wink, and the wink control refuses to send
 * into a block by reading `isBlocked` off the row it was handed — a row from
 * the `["ms","people"]` page, not from the profile query. Between the block
 * click and the refetch, that stale row would still have offered a wink at
 * somebody the reader had just decided they wanted nothing to do with.
 */
describe("patchBlockInData", () => {
  it("stamps the block onto a directory row", () => {
    const data = { pages: [{ items: [{ id: "a", isBlocked: false, isFollowing: true }] }] };
    const next = patchBlockInData(data, "a", true) as typeof data;
    assert.deepEqual(next.pages[0]?.items[0], { id: "a", isBlocked: true, isFollowing: false });
  });

  it("severs the follow when blocking, and does not restore it when unblocking", () => {
    // The server does not give the follow back either, so neither does this.
    const data = { items: [{ id: "a", isBlocked: true, isFollowing: false }] };
    const next = patchBlockInData(data, "a", false) as typeof data;
    assert.deepEqual(next.items[0], { id: "a", isBlocked: false, isFollowing: false });
  });

  it("reaches a profile nested under a search result", () => {
    const data = { items: [{ kind: "profile", id: "r1", profile: { id: "a", isBlocked: false } }] };
    const next = patchBlockInData(data, "a", true) as typeof data;
    assert.equal(next.items[0]?.profile.isBlocked, true);
  });

  it("leaves other people, and a row that does not carry the field, alone", () => {
    // A ProfileSummary has no viewer edge on it; inventing one would be worse
    // than leaving it, because the row would then claim an answer it never got.
    const data = { items: [{ id: "b", isBlocked: false }, { id: "a", displayName: "A" }] };
    assert.equal(patchBlockInData(data, "a", true), data);
  });

  it("returns the same object when nothing changed, so nothing re-renders", () => {
    const data = { items: [{ id: "a", isBlocked: true }] };
    assert.equal(patchBlockInData(data, "a", true), data);
  });
});

/**
 * THE HOME FEED'S FOLLOW BUTTON.
 *
 * A signed-in feed carries `isFollowing` on every post author, and that answer
 * outranks the click by design. The patch walked only People, Explore and
 * Spotlight, so tapping Follow on a post changed nothing on screen until
 * something else refetched the feed — people tapped it five times thinking it
 * had not worked. These pin every cache that embeds a person, with a real
 * QueryClient, so no surface can fall out of a hand-kept list again.
 */
describe("a follow or a block lands on every cache that shows the person", () => {
  const KEYS = [
    ["ms", "feed", "for-you"],
    ["ms", "feed", "following"],
    ["ms", "post", "p1"],
    ["ms", "bookmarks"],
    ["ms", "profile-posts", "a"],
    ["ms", "stream", "s1"],
    ["ms", "people"],
    ["ms", "notifications", "social"],
  ];

  const seed = (person: Record<string, unknown>) => {
    const client = new QueryClient();
    const page = (items: unknown[]) => ({ pages: [{ items }], pageParams: [null] });
    client.setQueryData(KEYS[0]!, page([{ id: "i1", post: { id: "p1", author: person } }]));
    client.setQueryData(KEYS[1]!, page([{ id: "i2", post: { id: "p9", author: person } }]));
    client.setQueryData(KEYS[2]!, { id: "p1", author: person });
    client.setQueryData(KEYS[3]!, page([{ id: "p2", author: person }]));
    client.setQueryData(KEYS[4]!, page([{ id: "p3", author: person }]));
    client.setQueryData(KEYS[5]!, { id: "s1", owner: person });
    client.setQueryData(KEYS[6]!, page([person]));
    client.setQueryData(KEYS[7]!, page([{ id: "n1", kind: "wink", actor: person }]));
    return client;
  };

  it("flips the person to Following on every one of them", () => {
    const client = seed({ id: "a", username: "a", isFollowing: false });
    patchFollowInCaches(client, "a", true);
    for (const key of KEYS) {
      const json = JSON.stringify(client.getQueryData(key));
      assert.ok(
        json.includes('"isFollowing":true') && !json.includes('"isFollowing":false'),
        `${key.join("/")} still says not following, so its Follow button would not change`
      );
    }
  });

  it("stamps a block on every one of them, and severs the follow", () => {
    const client = seed({ id: "a", username: "a", isFollowing: true, isBlocked: false });
    patchBlockInCaches(client, "a", true);
    for (const key of KEYS) {
      const json = JSON.stringify(client.getQueryData(key));
      assert.ok(json.includes('"isBlocked":true') && json.includes('"isFollowing":false'), `${key.join("/")} missed the block`);
    }
  });

  it("moves the profile page's follower count exactly once", () => {
    const client = new QueryClient();
    client.setQueryData(["ms", "profile", "a"], { id: "a", username: "a", isFollowing: false, followerCount: 5 });
    patchFollowInCaches(client, "a", true);
    patchFollowInCaches(client, "a", true);
    assert.deepEqual(client.getQueryData(["ms", "profile", "a"]), {
      id: "a",
      username: "a",
      isFollowing: true,
      followerCount: 6,
    });
  });

  it("leaves caches that do not hold the person untouched", () => {
    const client = new QueryClient();
    const other = { pages: [{ items: [{ id: "b", isFollowing: false }] }], pageParams: [null] };
    client.setQueryData(["ms", "feed", "for-you"], other);
    patchFollowInCaches(client, "a", true);
    assert.equal(client.getQueryData(["ms", "feed", "for-you"]), other);
  });
});
