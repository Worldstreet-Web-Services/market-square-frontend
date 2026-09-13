import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReplySwipe,
  SWIPE_MAX,
  SWIPE_TRIGGER,
  swipeCommits,
  swipeOffset,
} from "./swipe-reply.ts";

describe("swipe-to-reply", () => {
  it("does NOT claim a scroll that drifts sideways", () => {
    // The failure that matters: a thread whose main gesture is scrolling must
    // not feel stuck because a finger wandered a few pixels across.
    assert.equal(isReplySwipe(20, 90), false);
    assert.equal(isReplySwipe(30, 25), false, "a diagonal is still a scroll");
    assert.equal(swipeCommits(60, 200), false, "far enough across, but it was a scroll");
  });

  it("claims a clearly horizontal pull", () => {
    assert.equal(isReplySwipe(60, 5), true);
    assert.equal(swipeCommits(SWIPE_TRIGGER, 0), true);
  });

  it("is rightward only, on every bubble", () => {
    // A direction that flips depending on who sent the message is one the
    // hand cannot learn.
    assert.equal(isReplySwipe(-80, 0), false);
    assert.equal(swipeOffset(-80), 0);
  });

  it("does not commit before the trigger", () => {
    assert.equal(swipeCommits(SWIPE_TRIGGER - 1, 0), false);
  });

  it("tracks the finger, then goes heavy past the trigger", () => {
    assert.equal(swipeOffset(20), 20, "1:1 before the trigger");
    assert.equal(swipeOffset(SWIPE_TRIGGER), SWIPE_TRIGGER);
    const past = swipeOffset(SWIPE_TRIGGER + 40);
    assert.ok(past > SWIPE_TRIGGER, "it keeps moving, so the gesture stays alive");
    assert.ok(past < SWIPE_TRIGGER + 40, "but it resists, which is how the hand feels the trigger");
  });

  it("never travels past its cap, however hard somebody pulls", () => {
    assert.equal(swipeOffset(10_000), SWIPE_MAX);
  });
});
