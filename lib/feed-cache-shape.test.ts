import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { describe, it } from "node:test";
import {
  isInfiniteFeed,
  patchPostEverywhere,
  POST_LIST_KEYS,
} from "../features/feed/lib/cache.ts";
import { errorMessage } from "./api/envelope.ts";

/**
 * THE BUG THIS FILE EXISTS FOR — ogazboiz could not post at all.
 *
 * `useFeedHead` caches a BARE FeedPage at ["ms","feed",lane,key,"head"]. Every
 * writer here matches by PREFIX, so it matches that too — and each of them
 * checked `if (data)` and then reached for `data.pages`. A bare FeedPage is a
 * perfectly good object, so the null check passed and the property access
 * threw:
 *
 *   publish            data.pages[0]    → "Cannot read properties of undefined (reading '0')"
 *   like / bookmark    data.pages.map   → "... (reading 'map')"
 *
 * Thrown inside onSuccess, which meant the post WAS created on the server and
 * the mutation then reported failure — so the composer stayed open, showed a
 * raw JS message, and invited the reader to post the same thing again.
 */

const post = (id: string) => ({
  id,
  kind: "update" as const,
  text: "hello",
  createdAt: "2026-09-09T00:00:00.000Z",
  likeCount: 0,
  likedByMe: false,
});

const feedItem = (id: string) => ({
  id: `it_${id}`,
  type: "post" as const,
  occurredAt: "2026-09-09T00:00:00.000Z",
  repostedBy: null,
  deepLink: null,
  post: post(id),
  stream: null,
  activity: null,
  platformEvent: null,
});

describe("isInfiniteFeed", () => {
  it("recognises an infinite feed", () => {
    assert.equal(isInfiniteFeed({ pages: [{ items: [] }], pageParams: [] }), true);
  });

  it("rejects the head query's bare FeedPage — the exact value that broke posting", () => {
    assert.equal(isInfiniteFeed({ items: [], nextCursor: null }), false);
  });

  it("rejects nothing at all", () => {
    assert.equal(isInfiniteFeed(undefined), false);
    assert.equal(isInfiniteFeed(null), false);
  });

  it("rejects a `pages` that is not an array", () => {
    // A null check would pass this too.
    assert.equal(isInfiniteFeed({ pages: undefined }), false);
    assert.equal(isInfiniteFeed({ pages: 3 }), false);
  });
});

describe("patchPostEverywhere with a head-shaped entry under the same prefix", () => {
  const seed = () => {
    const client = new QueryClient();
    client.setQueryData(["ms", "feed", "for-you", ""], {
      pages: [{ items: [feedItem("p1")], nextCursor: null }],
      pageParams: [undefined],
    });
    // The fifth shape: a plain useQuery under the SAME prefix.
    client.setQueryData(["ms", "feed", "for-you", "", "head"], {
      items: [feedItem("p1")],
      nextCursor: null,
    });
    return client;
  };

  it("does not throw", () => {
    const client = seed();
    assert.doesNotThrow(() =>
      patchPostEverywhere(client, "p1", (p) => ({ ...p, likedByMe: true, likeCount: 1 }))
    );
  });

  it("still patches the real infinite lane", () => {
    const client = seed();
    patchPostEverywhere(client, "p1", (p) => ({ ...p, likedByMe: true, likeCount: 1 }));
    const lane = client.getQueryData(["ms", "feed", "for-you", ""]) as {
      pages: { items: { post: { likedByMe: boolean } }[] }[];
    };
    assert.equal(lane.pages[0]!.items[0]!.post.likedByMe, true);
  });

  it("leaves the head entry exactly as it found it", () => {
    // Not "patches it correctly" — LEAVES IT. A writer that does not
    // understand a shape must not guess at it.
    const client = seed();
    const before = client.getQueryData(["ms", "feed", "for-you", "", "head"]);
    patchPostEverywhere(client, "p1", (p) => ({ ...p, likedByMe: true }));
    assert.deepEqual(client.getQueryData(["ms", "feed", "for-you", "", "head"]), before);
  });

  it("guards the bookmarks prefix the same way", () => {
    const client = new QueryClient();
    client.setQueryData([...POST_LIST_KEYS.bookmarks], { items: [], nextCursor: null });
    assert.doesNotThrow(() => patchPostEverywhere(client, "p1", (p) => p));
  });
});

describe("errorMessage never shows a raw JS exception", () => {
  it("falls back for an error with no code — the toast ogazboiz actually saw", () => {
    const thrown = new TypeError("Cannot read properties of undefined (reading '0')");
    assert.equal(
      errorMessage(thrown, "Couldn't post that — try again."),
      "Couldn't post that — try again."
    );
  });

  it("still shows the service's own sentence for a code it does not know", () => {
    // An unknown CODE means the service wrote that message for a reader; it is
    // more useful than a generic line and must survive.
    assert.equal(
      errorMessage({ code: "GROUP_FULL", message: "A group holds at most 500 people" }, "nope"),
      "A group holds at most 500 people"
    );
  });

  it("uses the fallback when an unknown code carries no message", () => {
    assert.equal(errorMessage({ code: "WEIRD" }, "fallback wins"), "fallback wins");
  });
});
