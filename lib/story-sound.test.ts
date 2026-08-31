import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

/**
 * WHAT IS LEFT IN THIS FILE, AND WHY IT STILL READS SOURCE.
 *
 * This file used to assert on the text of `stories-row.tsx` for the whole of
 * the viewer's playback behaviour — the clip length, the cap, the guard
 * against an unmeasurable duration, the pause reasons. All of that is now
 * pure and pinned properly in `lib/story-playback.test.ts`, which tests the
 * decisions rather than the characters they were written with. A source
 * regex only ever proved a line existed; it could not have caught any of the
 * bugs that were actually in here, because every one of them was in how the
 * lines composed at runtime.
 *
 * What remains is the JSX WIRING, which has no pure half to extract: which of
 * the two `<video>` elements is bound to the sound setting and which is
 * hard-muted, and that hovering is bound to `pointermove` rather than
 * `pointerenter`. Those are one-line facts about the markup that a reader can
 * silently undo, and they each caused a shipped bug, so they are worth a
 * tripwire even a crude one. Everything else belongs to the other file.
 */
const source = readFileSync(
  join(process.cwd(), "features/feed/components/stories-row.tsx"),
  "utf8"
);

describe("story video sound", () => {
  // Both copies of the clip were hard-muted with no control, so a story with
  // audio was always silent.
  test("the foreground clip follows the sound setting", () => {
    assert.match(source, /muted=\{!soundOn\}/);
    assert.match(source, /aria-label=\{soundOn \? "Mute story" : "Unmute story"\}/);
  });

  // The backdrop is the same file decoded a second time. If it ever carried
  // audio, every story would play over itself slightly out of sync.
  test("the blurred backdrop copy stays muted unconditionally", () => {
    const backdrop = source.slice(source.indexOf("scale-125 object-cover blur-2xl") - 900);
    const decorative = backdrop.slice(0, backdrop.indexOf("aria-hidden"));
    assert.ok(decorative.includes("muted\n"), "backdrop video is plainly muted");
    assert.ok(!decorative.includes("muted={"), "backdrop is never bound to the setting");
  });

  // Sound defaults to ON — the viewer only opens from a tap, which is the
  // gesture the autoplay policy asks for. WHICH rejections may turn it off
  // again is `isAutoplayRefusal`, tested for real in story-playback.test.ts.
  test("sound starts on, and only a real refusal turns it off", () => {
    assert.match(source, /const \[soundOn, setSoundOn\] = useState\(true\)/);
    const play = source.slice(source.indexOf("void node.play().catch("));
    assert.match(play, /if \(!isAutoplayRefusal\(error\)\) return;\s*setSoundOn\(false\);/);
  });
});

describe("holding a story", () => {
  /*
   * Hover-to-pause must be bound to pointerMOVE, and this is the tripwire for
   * the regression that put it there.
   *
   * `pointerenter` also fires when an element APPEARS under a stationary
   * cursor — which is what an overlay does. Opening a story from a rail tile
   * sitting under the centred card paused it on the frame it opened on, and
   * since the mouse never moved again, nothing ever fired `pointerleave` to
   * release it: the clip sat frozen at 0:00 with its blurred backdrop still
   * running behind it. `pointermove` is only ever produced by real movement.
   */
  test("hovering pauses on real movement only, and only for a mouse", () => {
    // The prop, not the prose: the comment above the tap zones names
    // `onPointerEnter` precisely to record why it is gone.
    assert.ok(
      !/onPointerEnter=\{/.test(source),
      "pointerenter fires under a stationary cursor — it must not drive the hold"
    );
    const moves = source.match(/onPointerMove=\{\(event\) =>[^}]*\}/g) ?? [];
    assert.equal(moves.length, 2, "both tap zones pause on hover");
    for (const handler of moves) {
      assert.match(
        handler,
        /event\.pointerType === "mouse"/,
        "a tap fires the hover events too — touch must not take this path"
      );
      assert.match(handler, /setHovering\(true\)/);
    }
  });

  test("a story can never be left held forever", () => {
    // Every reason that sets a hold has a release that cannot be missed:
    // leaving the zone clears both, and a press is also released from the
    // window, so letting go anywhere — or losing the pointer, or tabbing away
    // mid-press — resumes the story.
    const leaves = source.match(/onPointerLeave=\{\(\) => \{\s*setHovering\(false\);\s*setPressing\(false\);\s*\}\}/g) ?? [];
    assert.equal(leaves.length, 2, "leaving a tap zone clears both holds");
    assert.match(source, /window\.addEventListener\("pointerup", release\)/);
    assert.match(source, /window\.addEventListener\("pointercancel", release\)/);
    assert.match(source, /window\.addEventListener\("blur", blur\)/);
  });
});
