import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dotScale, emptyLevels, pushLevel, rmsLevel, WAVEFORM_DOTS } from "./voice-levels.ts";

const frame = (value: number, n = 64) => Array.from({ length: n }, () => value);

describe("the voice waveform's maths", () => {
  it("reports SILENCE for a flat line at 128, not 'loud'", () => {
    // getByteTimeDomainData centres on 128. Averaging the raw bytes would
    // call perfect silence maximally loud — the classic bug in this code.
    assert.equal(rmsLevel(frame(128)), 0);
  });

  it("rises with amplitude and never exceeds 1", () => {
    const quiet = rmsLevel(frame(136));
    const loud = rmsLevel(frame(200));
    assert.ok(quiet > 0, "a small deflection must register");
    assert.ok(loud > quiet, "louder must read louder");
    assert.ok(rmsLevel(frame(255)) <= 1, "a shout must not overflow the row");
    assert.ok(rmsLevel(frame(0)) <= 1, "nor must a full negative swing");
  });

  it("is symmetric — a negative swing is as loud as a positive one", () => {
    assert.equal(rmsLevel(frame(78)), rmsLevel(frame(178)));
  });

  it("survives an empty frame rather than dividing by zero", () => {
    assert.equal(rmsLevel([]), 0);
  });

  it("keeps the newest levels and drops the oldest", () => {
    let buf = [1, 2, 3];
    buf = pushLevel(buf, 4, 3);
    assert.deepEqual(buf, [2, 3, 4]);
  });

  it("returns a NEW array, or React would never re-render", () => {
    const buf = [0.1];
    assert.notEqual(pushLevel(buf, 0.2, 4), buf);
  });

  it("starts at full width so the row does not grow into place", () => {
    assert.equal(emptyLevels().length, WAVEFORM_DOTS);
    assert.ok(emptyLevels().every((v) => v === 0));
  });

  it("never draws a dot at zero height — silence is a small dot, not a gap", () => {
    assert.ok(dotScale(0) > 0, "a zero-height dot reads as a hole in the row");
    assert.ok(dotScale(1) <= 1);
    assert.ok(dotScale(1) > dotScale(0));
    // Out-of-range input is clamped rather than trusted.
    assert.equal(dotScale(5), dotScale(1));
    assert.equal(dotScale(-5), dotScale(0));
  });
});
