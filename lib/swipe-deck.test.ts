import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMMIT_RATIO,
  MAX_ROTATION_DEG,
  exitOffset,
  isHorizontalGesture,
  swipeDecision,
  swipeProgress,
  swipeRotation,
} from "./swipe-deck.ts";

const W = 300;

describe("swipeProgress", () => {
  it("is signed and clamped, so overdrag cannot overstate", () => {
    assert.equal(swipeProgress(0, W), 0);
    assert.equal(swipeProgress(150, W), 0.5);
    assert.equal(swipeProgress(-150, W), -0.5);
    assert.equal(swipeProgress(9000, W), 1);
    assert.equal(swipeProgress(-9000, W), -1);
  });

  it("never divides by a zero or absent width", () => {
    assert.equal(swipeProgress(50, 0), 0);
    assert.equal(swipeProgress(Number.NaN, W), 0);
  });
});

describe("swipeRotation", () => {
  it("leans with the drag and stops at the cap", () => {
    assert.equal(swipeRotation(W, W), MAX_ROTATION_DEG);
    assert.equal(swipeRotation(-W, W), -MAX_ROTATION_DEG);
    assert.equal(Math.abs(swipeRotation(9000, W)), MAX_ROTATION_DEG);
  });
});

describe("isHorizontalGesture", () => {
  it("rejects a drag that is really a page scroll", () => {
    assert.equal(isHorizontalGesture(10, 200), false);
    assert.equal(isHorizontalGesture(200, 10), true);
  });
});

describe("swipeDecision", () => {
  const at = (dx: number, dy = 0, velocity = 0) => swipeDecision({ dx, dy, width: W, velocity });

  it("commits past the distance threshold, in the direction thrown", () => {
    assert.equal(at(W * COMMIT_RATIO + 1), "follow");
    assert.equal(at(-(W * COMMIT_RATIO + 1)), "pass");
  });

  it("springs back below the threshold", () => {
    assert.equal(at(W * COMMIT_RATIO - 1), null);
    assert.equal(at(-(W * COMMIT_RATIO - 1)), null);
  });

  it("lets a fast flick commit at a short distance", () => {
    assert.equal(at(20, 0, 0.9), "follow");
    assert.equal(at(-20, 0, -0.9), "pass");
  });

  it("will not let velocity commit AGAINST the direction dragged", () => {
    // A hard leftward flick that ends a few px right of centre is a pass —
    // never a follow, which is a public act.
    assert.equal(at(5, 0, -0.9), null);
    assert.equal(at(-5, 0, 0.9), null);
  });

  it("treats a mostly-vertical drag as a scroll, however far it went", () => {
    assert.equal(at(120, 400), null);
    assert.equal(at(-120, 400), null);
  });

  it("answers null — spring back — for anything ambiguous", () => {
    /*
      The asymmetry is deliberate. Committing a follow nobody meant performs a
      public act on their behalf; springing back costs one more swipe.
    */
    assert.equal(at(0), null);
    assert.equal(swipeDecision({ dx: 100, dy: 0, width: 0 }), null);
    assert.equal(swipeDecision({ dx: Number.NaN, dy: 0, width: W }), null);
  });
});

describe("exitOffset", () => {
  it("throws the card off the side it was sent", () => {
    assert.ok(exitOffset("follow", W) > W);
    assert.ok(exitOffset("pass", W) < -W);
  });
});
