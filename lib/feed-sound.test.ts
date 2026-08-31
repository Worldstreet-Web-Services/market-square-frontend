import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  getFeedSoundServerSnapshot,
  isFeedSoundOn,
  resetFeedSoundForTest,
  setFeedSoundOn,
  preferSoundForImmersive,
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

test("opening a video full-screen turns sound on", () => {
  // Tapping a video to fill the screen is a request to watch it, not to mime
  // it — the story viewer already behaves this way.
  preferSoundForImmersive();
  assert.equal(isFeedSoundOn(), true);
});

test("but never over a reader who chose quiet", () => {
  // Muting and continuing to swipe means "keep it quiet". Re-unmuting on the
  // next post is the same disrespect as forgetting a request for sound.
  setFeedSoundOn(false);
  preferSoundForImmersive();
  assert.equal(isFeedSoundOn(), false);
});

test("a reader who turned sound on stays on", () => {
  setFeedSoundOn(true);
  preferSoundForImmersive();
  assert.equal(isFeedSoundOn(), true);
});

test("opening full-screen twice notifies once", () => {
  let calls = 0;
  subscribeFeedSound(() => (calls += 1));
  preferSoundForImmersive();
  preferSoundForImmersive();
  assert.equal(calls, 1);
});
