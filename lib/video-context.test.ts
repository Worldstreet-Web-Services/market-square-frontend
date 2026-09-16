import assert from "node:assert/strict";
import { test } from "node:test";
import { nextVideoIndex, videoHref, videoListKey } from "./video-context.ts";

test("the same selection always produces the same key, whatever the chip order", () => {
  // The grid and the viewer must land on ONE cache entry, or the viewer
  // re-fetches page one instead of continuing the grid's pagination.
  assert.equal(videoListKey(["reels", "gaming"]), videoListKey(["gaming", "reels"]));
  assert.equal(videoListKey([]), "");
  // Different selections must not collide.
  assert.notEqual(videoListKey(["gaming"]), videoListKey(["arts"]));
});

test("arrow-key movement clamps and never wraps", () => {
  assert.equal(nextVideoIndex(0, -1, 3), 0);
  assert.equal(nextVideoIndex(2, 1, 3), 2);
  assert.equal(nextVideoIndex(1, 1, 3), 2);
  assert.equal(nextVideoIndex(1, -1, 3), 0);
  assert.equal(nextVideoIndex(0, 1, 0), 0);
});

test("a shared link carries the selection, not just the clip", () => {
  assert.equal(videoHref("p1", { tab: "shows" }), "/square/discover?tab=shows&v=p1");
  // The default tab stays out of the URL rather than bloating every share.
  assert.equal(videoHref("p1", { tab: "for-you" }), "/square/discover?v=p1");
  assert.equal(videoHref("p1", {}), "/square/discover?v=p1");
  assert.equal(
    videoHref("p1", { query: " ark ", tab: "posts" }),
    "/square/discover?q=ark&tab=posts&v=p1"
  );
});
