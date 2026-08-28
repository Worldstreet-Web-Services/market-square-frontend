import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import assert from "node:assert/strict";

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
    const backdrop = source.slice(source.indexOf("scale-125 object-cover blur-2xl") - 600);
    const decorative = backdrop.slice(0, backdrop.indexOf("aria-hidden"));
    assert.ok(decorative.includes("muted\n"), "backdrop video is plainly muted");
    assert.ok(!decorative.includes("muted={"), "backdrop is never bound to the setting");
  });

  // Sound defaults to ON — the viewer only opens from a tap, which is the
  // gesture the autoplay policy asks for. The refusal path is what keeps that
  // safe: a rejected play() drops to muted and plays, rather than leaving the
  // story frozen on its first frame.
  test("sound starts on, with a muted retry when autoplay refuses", () => {
    assert.match(source, /const \[soundOn, setSoundOn\] = useState\(true\)/);
    const play = source.slice(source.indexOf("if (cancelled || !soundOn) return;"));
    assert.match(play, /setSoundOn\(false\);\s*void node\.play\(\)/);
  });

  // Cutting every clip at the picture duration is why sound "did not work" —
  // five seconds of a thirty-second video, then the viewer moved on.
  test("a clip is timed by its own length, capped and guarded", () => {
    assert.match(source, /STORY_VIDEO_MAX_MS/);
    assert.match(source, /Number\.isFinite\(seconds\)/);
    assert.match(source, /measured\?\.key === storyKey \? measured\.ms : STORY_MS/);
  });
});
