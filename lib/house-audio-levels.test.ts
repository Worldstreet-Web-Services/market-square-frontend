import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANNOUNCE_STABLE_MS,
  ATTACK,
  BAR_FLOOR,
  LEVEL_INTERVAL_MS,
  METER_BARS,
  RELEASE,
  SILENCE_FLOOR,
  ZERO_SNAP,
  barOpacity,
  smooth,
} from "../features/houses/lib/audio-levels.ts";

/**
 * With no video, the level arc IS the picture of who is talking. These are the
 * rules that make it readable rather than merely animated.
 */
describe("smooth", () => {
  it("rises faster than it falls", () => {
    const up = smooth(0, 1, true);
    const down = 1 - smooth(1, 0, false);
    assert.ok(up > down, `attack ${up} should outrun release ${down}`);
    assert.ok(ATTACK > RELEASE);
  });

  it("reaches a visible level on the FIRST tick a voice starts", () => {
    // 100ms per tick: a voice that took four ticks to appear would be visible
    // only after the first word was over.
    assert.ok(smooth(0, 0.9, true) > 0.4);
  });

  it("holds a quiet speaker at the silence floor while LiveKit says they are speaking", () => {
    // Softly-spoken people had a ring at nearly nothing while holding the
    // floor. The SFU's own voice-activity decision beats any threshold here.
    let level = 0;
    for (let i = 0; i < 40; i += 1) level = smooth(level, 0.01, true);
    assert.ok(level >= SILENCE_FLOOR - 0.001, `settled at ${level}`);
  });

  it("does not apply the floor when nobody is speaking", () => {
    let level = SILENCE_FLOOR;
    for (let i = 0; i < 80; i += 1) level = smooth(level, 0, false);
    assert.equal(level, 0);
  });

  it("snaps to exactly zero, so the arc disappears instead of leaving a stub", () => {
    // An exponential decay never reaches zero; a one-pixel arc that lives
    // forever says "still speaking, very quietly", which is a lie.
    assert.equal(smooth(ZERO_SNAP - 0.001, 0, false), 0);
    let level = 1;
    for (let i = 0; i < 200; i += 1) level = smooth(level, 0, false);
    assert.equal(level, 0);
  });

  it("never overshoots the range the arc is drawn in", () => {
    let level = 0;
    for (let i = 0; i < 200; i += 1) {
      level = smooth(level, i % 2 === 0 ? 1 : 0, i % 3 === 0);
      assert.ok(level >= 0 && level <= 1, `level ${level} out of range`);
    }
  });

  it("does not strobe: a gap between syllables leaves most of the arc standing", () => {
    // The regression this pins is symmetric smoothing, which drained to
    // nothing between words and read as a fault rather than a voice.
    let level = 0;
    for (let i = 0; i < 6; i += 1) level = smooth(level, 0.8, true);
    const loud = level;
    // Two ticks of silence — roughly the gap between two words.
    level = smooth(level, 0, false);
    level = smooth(level, 0, false);
    assert.ok(level > loud * 0.7, `fell from ${loud} to ${level} in 200ms`);
  });
});

describe("barOpacity", () => {
  it("is deterministic — the same level always draws the same meter", () => {
    // No randomness anywhere. The equaliser every music app draws is
    // decoration pretending to be an instrument.
    for (const level of [0, 0.3, 0.55, 1]) {
      for (let bar = 0; bar < METER_BARS; bar += 1) {
        assert.equal(barOpacity(level, bar), barOpacity(level, bar));
      }
    }
  });

  it("lights bars from the bottom up as the level climbs", () => {
    const quiet = Array.from({ length: METER_BARS }, (_, i) => barOpacity(0.25, i));
    const loud = Array.from({ length: METER_BARS }, (_, i) => barOpacity(1, i));
    // A quarter of the way up: the first bar is full, the last is at the floor.
    assert.equal(quiet[0], 1);
    assert.equal(quiet[3], BAR_FLOOR);
    // Each bar fades in across its own fifth of the range rather than snapping.
    assert.ok(barOpacity(0.8, 3) > BAR_FLOOR && barOpacity(0.8, 3) < 1);
    for (let i = 0; i < METER_BARS; i += 1) assert.ok(loud[i] >= quiet[i]);
    assert.equal(loud[3], 1);
  });

  it("never draws a fully dark bar — four invisible bars is a gap, not a meter", () => {
    for (let bar = 0; bar < METER_BARS; bar += 1) {
      assert.equal(barOpacity(0, bar), BAR_FLOOR);
      assert.ok(barOpacity(0, bar) > 0);
    }
  });

  it("clamps at 1 so a loud voice cannot brighten past the ramp", () => {
    for (let bar = 0; bar < METER_BARS; bar += 1) {
      assert.ok(barOpacity(4, bar) <= 1);
    }
  });
});

describe("cadence", () => {
  it("samples at the rate the publisher's own mic meter already runs at", () => {
    assert.equal(LEVEL_INTERVAL_MS, 100);
  });

  it("debounces the ANNOUNCEMENT far longer than it draws", () => {
    // The visible strip follows turn-taking immediately; only the screen
    // reader is spared "Ada. Tobi. Ada. Kemi."
    assert.ok(ANNOUNCE_STABLE_MS >= 20 * LEVEL_INTERVAL_MS);
  });
});
