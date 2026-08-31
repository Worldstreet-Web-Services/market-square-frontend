import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  getFeedSoundServerSnapshot,
  isFeedSoundOn,
  resetFeedSoundForTest,
  setFeedSoundOn,
  subscribeFeedSound,
} from "./feed-sound.ts";

beforeEach(() => resetFeedSoundForTest());

test("starts muted, because autoplay does", () => {
  assert.equal(isFeedSoundOn(), false);
  assert.equal(getFeedSoundServerSnapshot(), false);
});

test("the choice carries — this is the bug", () => {
  // One video is unmuted; every other video in the session reads the same
  // answer instead of asking again.
  setFeedSoundOn(true);
  assert.equal(isFeedSoundOn(), true);
});

test("every subscriber hears a change, so videos already on screen follow", () => {
  let a = 0;
  let b = 0;
  subscribeFeedSound(() => (a += 1));
  subscribeFeedSound(() => (b += 1));
  setFeedSoundOn(true);
  assert.equal(a, 1);
  assert.equal(b, 1);
});

test("setting the same value notifies nobody", () => {
  // Every InlineVideo on screen subscribes; re-rendering all of them because
  // a muted video was told it is muted is work for nothing.
  let calls = 0;
  subscribeFeedSound(() => (calls += 1));
  setFeedSoundOn(false);
  assert.equal(calls, 0);
  setFeedSoundOn(true);
  setFeedSoundOn(true);
  assert.equal(calls, 1);
});

test("unsubscribing stops the notifications", () => {
  let calls = 0;
  const off = subscribeFeedSound(() => (calls += 1));
  off();
  setFeedSoundOn(true);
  assert.equal(calls, 0);
});
