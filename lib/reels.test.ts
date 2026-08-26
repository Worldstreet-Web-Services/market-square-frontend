import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reelSlides } from "./reels.ts";

const reel = (id: string) => ({ id });

describe("reelSlides", () => {
  const items = [reel("a"), reel("b")];

  it("does not repeat while the server still has pages", () => {
    assert.deepEqual(
      reelSlides(items, 3, false).map((slide) => slide.key),
      ["a", "b"],
      "repeating early shows a clip twice while fresh ones are still waiting"
    );
  });

  it("loops once the server is exhausted", () => {
    assert.deepEqual(
      reelSlides(items, 1, true).map((slide) => slide.key),
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

  it("keeps the original order within every pass", () => {
    const order = reelSlides(items, 2, true).map((slide) => slide.item.id);
    assert.deepEqual(order, ["a", "b", "a", "b", "a", "b"]);
  });
});
