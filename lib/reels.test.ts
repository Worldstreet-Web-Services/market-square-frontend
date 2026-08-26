import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reelItems, reelSlides } from "./reels.ts";
import type { FeedItem } from "../features/feed/lib/types.ts";

const post = (id: string, mediaUrl: string | null): FeedItem =>
  ({ id, type: "post", post: { id, mediaUrl } }) as unknown as FeedItem;
const stream = (id: string): FeedItem => ({ id, type: "stream" }) as unknown as FeedItem;

describe("reelItems", () => {
  it("drops text-only posts, which cannot fill a slide", () => {
    const kept = reelItems([post("a", "https://x/1.jpg"), post("b", null)]);
    assert.deepEqual(
      kept.map((item) => item.id),
      ["a"]
    );
  });

  it("keeps streams, or the Live lane empties itself", () => {
    // The Live lane is built entirely from stream items. A filter that only
    // allowed posts with media would leave it blank.
    const kept = reelItems([stream("s1"), post("b", null)]);
    assert.deepEqual(
      kept.map((item) => item.id),
      ["s1"]
    );
  });
});

describe("reelSlides", () => {
  const items = [post("a", "m"), post("b", "m")];

  it("does not repeat while the server still has pages", () => {
    const slides = reelSlides(items, 3, false);
    assert.deepEqual(
      slides.map((slide) => slide.key),
      ["a", "b"],
      "repeating early shows a reel twice while fresh ones are still waiting"
    );
  });

  it("loops once the server is exhausted", () => {
    const slides = reelSlides(items, 1, true);
    assert.deepEqual(
      slides.map((slide) => slide.key),
      ["a", "b", "a#1", "b#1"]
    );
  });

  it("gives every repeat its own key", () => {
    const keys = reelSlides(items, 4, true).map((slide) => slide.key);
    assert.equal(new Set(keys).size, keys.length, "duplicate React keys drop slides");
  });

  it("never loops an empty feed into an infinite blank", () => {
    assert.deepEqual(reelSlides([], 5, true), []);
  });
});
