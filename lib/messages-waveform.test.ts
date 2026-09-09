import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WAVEFORM_BARS,
  playProgress,
  playedBars,
  waveformBars,
} from "../features/messages/lib/waveform.ts";

test("a note's bars are stable, so it does not reshuffle on every poll tick", () => {
  // The thread refetches every 5 seconds. Math.random here would visibly
  // redraw the waveform under the reader's eye each time.
  assert.deepEqual(waveformBars("msg_1"), waveformBars("msg_1"));
  assert.notDeepEqual(waveformBars("msg_1"), waveformBars("msg_2"));
});

test("no bar is flat and none overflows its row", () => {
  for (const height of waveformBars("msg_1")) {
    // A zero-height bar reads as a rendering fault rather than as quiet audio.
    assert.ok(height >= 0.25, `${height} below the floor`);
    assert.ok(height <= 1, `${height} above the row`);
  }
});

test("the bar count is honoured, and a degenerate one still draws something", () => {
  assert.equal(waveformBars("msg_1").length, WAVEFORM_BARS);
  assert.equal(waveformBars("msg_1", 8).length, 8);
  // A voice note drawn as an empty box would hide an upstream bug behind what
  // looks like a styling problem.
  assert.equal(waveformBars("msg_1", 0).length, 1);
  assert.equal(waveformBars("", 4).length, 4);
});

test("progress is clamped at both ends rather than trusted", () => {
  // Every one of these is normal in practice: metadata not loaded, a fresh
  // element with no currentTime, and a currentTime fractionally past the end
  // at the moment `ended` fires.
  assert.equal(playProgress(0, 0), 0);
  assert.equal(playProgress(5, 0), 0);
  assert.equal(playProgress(Number.NaN, 10), 0);
  assert.equal(playProgress(5, Number.POSITIVE_INFINITY), 0);
  assert.equal(playProgress(null, 10), 0);
  assert.equal(playProgress(5, null), 0);
  assert.equal(playProgress(-1, 10), 0);
  assert.equal(playProgress(11, 10), 1);
  assert.equal(playProgress(5, 10), 0.5);
});

test("lit bars never exceed the bars that exist, nor fall below none", () => {
  assert.equal(playedBars(10, 0), 0);
  assert.equal(playedBars(10, 0.5), 5);
  assert.equal(playedBars(10, 1), 10);
  assert.equal(playedBars(10, 2), 10);
  assert.equal(playedBars(10, -1), 0);
  assert.equal(playedBars(10, Number.NaN), 0);
  assert.equal(playedBars(0, 0.5), 0);
});
