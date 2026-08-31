import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  STORY_PICTURE_MS,
  STORY_STALL_GRACE_MS,
  STORY_VIDEO_MAX_MS,
  advanceRatio,
  clipDurationMs,
  hasOverrun,
  isAutoplayRefusal,
  isHeld,
  mediaToSilence,
  nextPosition,
  previousPosition,
  storyDurationMs,
} from "./story-playback.ts";

describe("how long a story holds", () => {
  test("a picture holds the fixed beat", () => {
    assert.equal(storyDurationMs(null), STORY_PICTURE_MS);
  });

  test("a clip is timed by its own length", () => {
    assert.equal(clipDurationMs(30), 30_000);
    assert.equal(storyDurationMs(clipDurationMs(30)), 30_000);
  });

  test("a clip longer than the cap is cut at the cap, not at the picture beat", () => {
    // Cutting every clip at the picture beat is why sound "did not work":
    // five seconds of a thirty-second video, then the viewer moved on.
    assert.equal(clipDurationMs(600), STORY_VIDEO_MAX_MS);
  });

  test("a length that cannot time anything falls back to the picture beat", () => {
    // A live or fragmented stream reports Infinity and an unreadable file
    // reports NaN. Timing a story off either stalls the whole set forever.
    for (const seconds of [Infinity, Number.NaN, 0, -4]) {
      assert.equal(clipDurationMs(seconds), null, `duration ${seconds}`);
      assert.equal(storyDurationMs(clipDurationMs(seconds)), STORY_PICTURE_MS);
    }
  });

  test("a clip that stops downloading for good does not park the reader on one frame", () => {
    assert.equal(hasOverrun(12_000, 12_000 + STORY_STALL_GRACE_MS - 1), false);
    assert.equal(hasOverrun(12_000 + STORY_STALL_GRACE_MS, 12_000), true);
  });
});

describe("the progress bar", () => {
  test("it reads as a fraction of the story's length", () => {
    assert.equal(advanceRatio(0, 2500, 5000), 0.5);
  });

  test("it never runs past the end", () => {
    assert.equal(advanceRatio(0, 9000, 5000), 1);
  });

  test("it does not LEAP when a measured clip length replaces the picture beat", () => {
    // The bug: elapsed time was stored as a FRACTION of the duration, so the
    // same 0.2 meant 1s of the 5s picture beat and then 6s of a 30s clip the
    // moment `loadedmetadata` landed — the bar jumped five seconds ahead of a
    // clip that had played one. Elapsed is milliseconds, so it cannot.
    const onTheBeat = advanceRatio(0, 1000, STORY_PICTURE_MS);
    assert.equal(onTheBeat, 0.2);
    // Same elapsed time, longer story: the bar retreats to a smaller share of
    // a bigger whole rather than scaling the fraction up.
    assert.equal(advanceRatio(0, 1000, 30_000), 1000 / 30_000);
  });

  test("it never goes backwards", () => {
    // When the clip's own clock takes over from the wall clock, `currentTime`
    // is a little behind the wall time already spent — which would drag a
    // segment that had visibly advanced back down the bar.
    assert.equal(advanceRatio(0.4, 1000, 30_000), 0.4);
  });

  test("a zero-length story is simply over", () => {
    assert.equal(advanceRatio(0, 0, 0), 1);
  });
});

describe("moving through the set", () => {
  const sizes = [3, 1, 2];

  test("on through the author's own stories first", () => {
    assert.deepEqual(nextPosition({ group: 0, story: 0 }, sizes), { group: 0, story: 1 });
  });

  test("then into the next author, from their first story", () => {
    assert.deepEqual(nextPosition({ group: 0, story: 2 }, sizes), { group: 1, story: 0 });
  });

  test("the end of the last story closes the viewer", () => {
    assert.equal(nextPosition({ group: 2, story: 1 }, sizes), null);
  });

  test("an author with no stories is stepped over, never landed on", () => {
    // Nothing can advance past a blank frame: there is no media to end and no
    // measured length, so the set would strand there.
    assert.deepEqual(nextPosition({ group: 0, story: 0 }, [1, 0, 0, 2]), { group: 3, story: 0 });
    assert.equal(nextPosition({ group: 0, story: 0 }, [1, 0]), null);
  });

  test("back steps within the author, then into the previous author's LAST story", () => {
    assert.deepEqual(previousPosition({ group: 0, story: 2 }, sizes), { group: 0, story: 1 });
    assert.deepEqual(previousPosition({ group: 2, story: 0 }, sizes), { group: 1, story: 0 });
    assert.deepEqual(previousPosition({ group: 1, story: 0 }, sizes), { group: 0, story: 2 });
  });

  test("back on the very first story stays put — it must not close the set", () => {
    // Tapping back used to close the whole viewer, which reads as the app
    // deciding you are done because you asked to see something again. The
    // caller replays the current story instead.
    const first = { group: 0, story: 0 };
    assert.deepEqual(previousPosition(first, sizes), first);
  });

  test("back skips empty authors on the way", () => {
    assert.deepEqual(previousPosition({ group: 3, story: 0 }, [2, 0, 0, 1]), { group: 0, story: 1 });
  });
});

describe("holding a story", () => {
  const none = { pressing: false, hovering: false, hidden: false };

  test("any one reason holds it", () => {
    assert.equal(isHeld(none), false);
    assert.equal(isHeld({ ...none, pressing: true }), true);
    assert.equal(isHeld({ ...none, hovering: true }), true);
    assert.equal(isHeld({ ...none, hidden: true }), true);
  });

  test("releasing one reason does not resume while another still holds", () => {
    // The reason this is a set and not a boolean: a reader presses and holds
    // with the cursor inside the frame, and whichever release fired first used
    // to resume a story the other reason still wanted held.
    assert.equal(isHeld({ pressing: false, hovering: true, hidden: false }), true);
  });
});

describe("a rejected play()", () => {
  test("the autoplay policy refusing sound is the one case worth answering", () => {
    assert.equal(isAutoplayRefusal({ name: "NotAllowedError" }), true);
  });

  test("an AbortError is NOT a refusal", () => {
    // play() rejects with AbortError whenever a pause or a new src overtakes
    // it — which happens every time the reader taps through stories quickly.
    // Treating it as "the browser refused sound" turned sound off for every
    // story that followed: three taps silenced the session.
    assert.equal(isAutoplayRefusal({ name: "AbortError" }), false);
  });

  test("a clip the browser cannot decode is not a sound problem either", () => {
    assert.equal(isAutoplayRefusal({ name: "NotSupportedError" }), false);
  });

  test("it survives a rejection that is not an Error at all", () => {
    for (const value of [undefined, null, "NotAllowedError", 7]) {
      assert.equal(isAutoplayRefusal(value), false);
    }
  });
});

describe("silencing the rest of the page", () => {
  const media = (paused: boolean, id: string) => ({ paused, id });

  test("it stops everything else that is playing", () => {
    // A feed clip 60% on screen went on playing, with sound, underneath a
    // story that was also playing with sound. Two voices at once.
    const feed = media(false, "feed");
    const stopped = mediaToSilence([feed, media(false, "ad")], () => false);
    assert.deepEqual(stopped.map((m) => m.id), ["feed", "ad"]);
  });

  test("it never touches the viewer's own media", () => {
    const ours = media(false, "story");
    const stopped = mediaToSilence([ours, media(false, "feed")], (m) => m === ours);
    assert.deepEqual(stopped.map((m) => m.id), ["feed"]);
  });

  test("it collects only what it actually stopped, so closing restarts only that", () => {
    // The returned list IS the undo. Resuming everything on the way out would
    // start clips the reader had deliberately left paused.
    const stopped = mediaToSilence([media(true, "left-alone"), media(false, "playing")], () => false);
    assert.deepEqual(stopped.map((m) => m.id), ["playing"]);
  });
});
