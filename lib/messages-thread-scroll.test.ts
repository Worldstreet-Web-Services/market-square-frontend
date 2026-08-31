import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STICK_THRESHOLD,
  isAtBottom,
} from "../features/messages/lib/thread-scroll.ts";

test("a thread shorter than its pane is always at the bottom", () => {
  // No overflow means no history to scroll up into, so it always follows.
  assert.equal(isAtBottom({ scrollTop: 0, scrollHeight: 400, clientHeight: 800 }), true);
});

test("scrolled all the way down is at the bottom", () => {
  assert.equal(isAtBottom({ scrollTop: 1200, scrollHeight: 2000, clientHeight: 800 }), true);
});

test("scrolled up into history is not at the bottom", () => {
  // 1000px from the live edge — someone is reading, do not yank them down.
  assert.equal(isAtBottom({ scrollTop: 200, scrollHeight: 2000, clientHeight: 800 }), false);
});

test("the threshold forgives the last few pixels", () => {
  const nearly = { scrollTop: 1200 - STICK_THRESHOLD, scrollHeight: 2000, clientHeight: 800 };
  assert.equal(isAtBottom(nearly), true);

  const justPast = { scrollTop: 1200 - STICK_THRESHOLD - 1, scrollHeight: 2000, clientHeight: 800 };
  assert.equal(isAtBottom(justPast), false);
});

test("iOS over-scroll bounce still counts as the bottom", () => {
  // Rubber-banding past the end reports a distance below zero.
  assert.equal(isAtBottom({ scrollTop: 1260, scrollHeight: 2000, clientHeight: 800 }), true);
});

test("the threshold is caller-overridable", () => {
  const metrics = { scrollTop: 1150, scrollHeight: 2000, clientHeight: 800 };
  assert.equal(isAtBottom(metrics, 100), true);
  assert.equal(isAtBottom(metrics, 10), false);
});
