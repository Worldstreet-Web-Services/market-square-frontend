import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  electActiveVideo,
  getActiveVideoId,
  getActiveVideoServerSnapshot,
  HOLD_MARGIN,
  MIN_VISIBLE_RATIO,
  registerVideo,
  reportVideoVisibility,
  requestActiveVideo,
  resetVideoCoordinatorForTest,
  subscribeActiveVideo,
  VIDEO_LAYER,
  VISIBILITY_STEPS,
  type VideoCandidate,
} from "./video-coordinator.ts";

beforeEach(() => resetVideoCoordinatorForTest());

function candidate(
  id: string,
  ratio: number,
  { layer = VIDEO_LAYER.feed, seq = 0 }: { layer?: number; seq?: number } = {}
): VideoCandidate {
  return { id, ratio, layer, seq };
}

/* ---------------------------------------------------------------- election */

test("nothing on screen elects nobody", () => {
  assert.equal(electActiveVideo([], null), null);
});

test("a video below the threshold does not play, even alone", () => {
  // The band between "peeking in" and "being watched". Nothing plays here, so
  // scrolling through a run of text posts leaves the feed silent.
  assert.equal(electActiveVideo([candidate("a", 0.59)], null), null);
  assert.equal(electActiveVideo([candidate("a", MIN_VISIBLE_RATIO)], null), "a");
});

test("THE BUG: two videos both clear the threshold and exactly one plays", () => {
  // A tall window puts two 420px cards past 60% at once. Every player used to
  // call play() on its own evidence, so both did.
  const winner = electActiveVideo(
    [candidate("upper", 0.7, { seq: 0 }), candidate("lower", 0.9, { seq: 1 })],
    null
  );
  assert.equal(winner, "lower");
});

test("the most visible wins", () => {
  assert.equal(
    electActiveVideo([candidate("a", 0.65), candidate("b", 0.99), candidate("c", 0.8)], null),
    "b"
  );
});

test("equal visibility with no incumbent breaks on registration order, not Map luck", () => {
  const forwards = [candidate("a", 0.8, { seq: 0 }), candidate("b", 0.8, { seq: 1 })];
  assert.equal(electActiveVideo(forwards, null), "a");
  // Same set, opposite array order: the answer must not move.
  assert.equal(electActiveVideo([...forwards].reverse(), null), "a");
});

test("equal visibility with an incumbent leaves the incumbent alone", () => {
  const both = [candidate("a", 0.8, { seq: 0 }), candidate("b", 0.8, { seq: 1 })];
  assert.equal(electActiveVideo(both, "b"), "b");
  // …and it is genuinely the incumbency doing it, not the ordering.
  assert.equal(electActiveVideo(both, "a"), "a");
});

test("a near-tie does not take the crown off the sitting video", () => {
  // Momentum scrolling walks two slides through this band. Without the margin
  // the crown changes hands every frame, and every change is a real pause()
  // and play() on a media element.
  const sitting = candidate("a", 0.80, { seq: 0 });
  assert.equal(electActiveVideo([sitting, candidate("b", 0.80 + HOLD_MARGIN)], "a"), "a");
  assert.equal(
    electActiveVideo([sitting, candidate("b", 0.80 + HOLD_MARGIN + 0.001)], "a"),
    "b"
  );
});

test("a clear winner still takes over", () => {
  assert.equal(electActiveVideo([candidate("a", 0.62), candidate("b", 1)], "a"), "b");
});

test("the full-screen viewer outranks the timeline it covers", () => {
  // The card underneath is fully visible to an IntersectionObserver and
  // completely hidden from the reader. Ratio alone would elect the wrong one,
  // and would elect it TWICE over — hence the layer.
  const card = candidate("card", 1, { layer: VIDEO_LAYER.feed, seq: 0 });
  const slide = candidate("slide", 0.7, { layer: VIDEO_LAYER.overlay, seq: 1 });
  assert.equal(electActiveVideo([card, slide], null), "slide");
  // Even mid-incumbency: opening the viewer is not a near-call to smooth over.
  assert.equal(electActiveVideo([card, slide], "card"), "slide");
});

test("closing the viewer hands the crown back to the timeline", () => {
  assert.equal(electActiveVideo([candidate("card", 1)], "slide"), "card");
});

test("an incumbent that scrolled away holds nothing", () => {
  assert.equal(
    electActiveVideo([candidate("a", 0.1, { seq: 0 }), candidate("b", 0.7, { seq: 1 })], "a"),
    "b"
  );
});

test("visibility dropping to zero everywhere stops playback outright", () => {
  assert.equal(electActiveVideo([candidate("a", 0), candidate("b", 0)], "a"), null);
});

test("a ratio that is not a number cannot win", () => {
  // An element measured before layout. `NaN >= 0.6` is false, and the guard is
  // written so that stays true.
  assert.equal(electActiveVideo([candidate("a", Number.NaN)], null), null);
  assert.equal(electActiveVideo([candidate("a", Number.NaN)], "a"), null);
});

/* ---------------------------------------------------------------- registry */

test("the registry starts with nobody playing, on the server too", () => {
  assert.equal(getActiveVideoId(), null);
  assert.equal(getActiveVideoServerSnapshot(), null);
});

test("registering does not itself start anything", () => {
  // A player joins at ratio 0 and reports its way up. Mounting must not steal
  // the crown from whatever the reader is already watching.
  registerVideo("a", VIDEO_LAYER.feed);
  assert.equal(getActiveVideoId(), null);
  reportVideoVisibility("a", 0.9);
  assert.equal(getActiveVideoId(), "a");
});

test("two registered players still leave exactly one active", () => {
  registerVideo("a", VIDEO_LAYER.feed);
  registerVideo("b", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.95);
  // Both are well past the threshold. Before the coordinator this was the
  // moment two soundtracks started; now the second one is simply not the
  // active id, and 0.98 against 0.95 is inside the hold margin, so `a` keeps
  // playing rather than the pair swapping under the reader.
  reportVideoVisibility("b", 0.98);
  assert.equal(getActiveVideoId(), "a");

  // Scroll on and `b` wins outright.
  reportVideoVisibility("a", 0.4);
  assert.equal(getActiveVideoId(), "b");
});

test("an unknown id reports nothing and changes nothing", () => {
  registerVideo("a", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.9);
  reportVideoVisibility("ghost", 1);
  assert.equal(getActiveVideoId(), "a");
});

test("the active video unmounting re-elects rather than leaving a dead crown", () => {
  const leaveA = registerVideo("a", VIDEO_LAYER.feed);
  registerVideo("b", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.95);
  reportVideoVisibility("b", 0.7);
  assert.equal(getActiveVideoId(), "a");
  leaveA();
  assert.equal(getActiveVideoId(), "b");
});

test("the last video unmounting leaves nobody, not a stale id", () => {
  const leave = registerVideo("a", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 1);
  leave();
  assert.equal(getActiveVideoId(), null);
});

test("leaving twice is harmless", () => {
  const leave = registerVideo("a", VIDEO_LAYER.feed);
  registerVideo("b", VIDEO_LAYER.feed);
  reportVideoVisibility("b", 0.9);
  leave();
  leave();
  assert.equal(getActiveVideoId(), "b");
});

test("opening the viewer over a playing card moves the crown, and closing it returns", () => {
  registerVideo("card", VIDEO_LAYER.feed);
  reportVideoVisibility("card", 1);
  assert.equal(getActiveVideoId(), "card");

  const closeViewer = registerVideo("slide", VIDEO_LAYER.overlay);
  reportVideoVisibility("slide", 0.9);
  assert.equal(getActiveVideoId(), "slide");

  closeViewer();
  assert.equal(getActiveVideoId(), "card");
});

test("subscribers hear the handovers and nothing else", () => {
  let changes = 0;
  subscribeActiveVideo(() => (changes += 1));
  registerVideo("a", VIDEO_LAYER.feed);
  assert.equal(changes, 0, "registering at ratio 0 elects nobody");
  reportVideoVisibility("a", 0.9);
  assert.equal(changes, 1);
  // Still the most visible thing on screen: same winner, no re-render.
  reportVideoVisibility("a", 0.95);
  assert.equal(changes, 1);
});

test("reporting the same ratio again does no work", () => {
  registerVideo("a", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.9);
  let changes = 0;
  subscribeActiveVideo(() => (changes += 1));
  reportVideoVisibility("a", 0.9);
  assert.equal(changes, 0);
});

test("unsubscribing stops the notifications", () => {
  let changes = 0;
  const off = subscribeActiveVideo(() => (changes += 1));
  off();
  registerVideo("a", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 1);
  assert.equal(changes, 0);
});

test("rapid churn never leaves two winners, and settles where the reader stopped", () => {
  // A flick down a column of slides: ratios cross each other repeatedly and
  // every report re-elects. The invariant under test is that there is only
  // ever ONE id, at every step — not just at the end.
  const ids = ["a", "b", "c", "d"];
  for (const id of ids) registerVideo(id, VIDEO_LAYER.feed);

  let handovers = 0;
  subscribeActiveVideo(() => (handovers += 1));

  for (let frame = 0; frame <= 60; frame += 1) {
    // A window sliding down the list: each slide rises and falls in turn.
    const scroll = (frame / 60) * (ids.length - 1);
    for (const [index, id] of ids.entries()) {
      reportVideoVisibility(id, Math.max(0, 1 - Math.abs(index - scroll)));
    }
    const active = getActiveVideoId();
    assert.ok(active === null || ids.includes(active));
  }

  assert.equal(getActiveVideoId(), "d", "settles on the slide that is on screen");
  // 244 reports went in. Hysteresis is what keeps the crown from following
  // every one of them: each handover is a real pause() and play() on a media
  // element, and one per frame is the stutter this margin exists to prevent.
  assert.ok(
    handovers <= 2 * ids.length,
    `expected a handful of handovers across the scroll, got ${handovers}`
  );
});

test("registering during churn cannot produce a second winner", () => {
  registerVideo("a", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.9);
  for (let n = 0; n < 20; n += 1) {
    registerVideo(`late-${n}`, VIDEO_LAYER.feed);
    reportVideoVisibility(`late-${n}`, 0.9);
    assert.equal(getActiveVideoId(), "a", "a near-tie never unseats the sitting video");
  }
});

/* ------------------------------------------------------- explicit requests */

test("tapping sound on a visible-but-passive clip moves the crown to it", () => {
  // Otherwise the tap turns sound on somewhere else on the screen, which the
  // reader cannot tell apart from the bug being reported.
  registerVideo("a", VIDEO_LAYER.feed);
  registerVideo("b", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.95);
  reportVideoVisibility("b", 0.7);
  assert.equal(getActiveVideoId(), "a");
  requestActiveVideo("b");
  assert.equal(getActiveVideoId(), "b");
});

test("a request cannot start a video that is barely on screen", () => {
  registerVideo("a", VIDEO_LAYER.feed);
  registerVideo("b", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.95);
  reportVideoVisibility("b", 0.2);
  requestActiveVideo("b");
  assert.equal(getActiveVideoId(), "a");
});

test("a request for an unregistered id changes nothing", () => {
  registerVideo("a", VIDEO_LAYER.feed);
  reportVideoVisibility("a", 0.9);
  requestActiveVideo("gone");
  assert.equal(getActiveVideoId(), "a");
});

/* ------------------------------------------------------------- observation */

test("the observer reports a curve, not a single crossing", () => {
  // One threshold of 0.6 says "past 60%" and never how far past; the election
  // compares ratios, so it needs the shape.
  assert.ok(VISIBILITY_STEPS.length > 2);
  assert.equal(VISIBILITY_STEPS[0], 0);
  assert.equal(VISIBILITY_STEPS.at(-1), 1);
  const gaps = VISIBILITY_STEPS.slice(1).map((step, i) => step - VISIBILITY_STEPS[i]);
  assert.ok(Math.max(...gaps) < HOLD_MARGIN, "steps must resolve finer than the hold margin");
});
