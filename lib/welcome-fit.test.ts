import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AIR_FLOOR, AIR_FULL_AT, bandCapWidth, welcomeAir } from "./welcome-fit.ts";

describe("welcomeAir", () => {
  it("changes nothing on the phone the design was tuned for", () => {
    // 390x844. Every gap in the column is the file's own number at this height,
    // so anything but exactly 1 would move a screen that was already correct.
    assert.equal(welcomeAir(844), 1);
  });

  it("changes nothing on a taller phone either", () => {
    assert.equal(welcomeAir(915), 1);
    assert.equal(welcomeAir(1080), 1);
  });

  it("closes the air up on the short viewports that overflowed", () => {
    // The three real cases measured before the fix, with how far over they ran:
    // 375x553 by 143px, 390x664 by 85, 360x620 by 69.
    for (const vh of [553, 620, 664, 740]) {
      const air = welcomeAir(vh);
      assert.ok(air < 1, `${vh} did not tighten`);
      assert.ok(air >= AIR_FLOOR, `${vh} went below the floor`);
    }
  });

  it("never closes past the floor, however short the viewport", () => {
    assert.equal(welcomeAir(200), AIR_FLOOR);
    assert.equal(welcomeAir(1), AIR_FLOOR);
  });

  it("is monotonic — a taller viewport never gets tighter gaps", () => {
    let prev = 0;
    for (let vh = 100; vh <= 1200; vh += 17) {
      const air = welcomeAir(vh);
      assert.ok(air >= prev, `air fell going from a shorter viewport to ${vh}`);
      prev = air;
    }
  });

  it("survives a viewport height the browser has not reported yet", () => {
    assert.equal(welcomeAir(0), 1);
    assert.equal(welcomeAir(Number.NaN), 1);
  });
});

describe("bandCapWidth", () => {
  it("converts the room left into the stage width that fills it", () => {
    // A band of 198 is what 390x844 renders today; the width that produces it
    // is the one the stylesheet must not go under there.
    const w = bandCapWidth(198);
    assert.ok(Math.abs((w / 1.40625) * 0.55 - 198) < 1e-9, "does not round-trip");
  });

  it("does not go negative when the column has already overflowed", () => {
    assert.equal(bandCapWidth(-40), 0);
    assert.equal(bandCapWidth(0), 0);
  });

  it("grows with the room, so more space can never mean smaller art", () => {
    assert.ok(bandCapWidth(300) > bandCapWidth(150));
  });

  it("is above the design's own 130vw whenever there is room to spare", () => {
    // 390x844 leaves ~292 of room; 130vw there is 507. The cap must lose that
    // min(), or a phone that already fits would be shrunk by this fix.
    assert.ok(bandCapWidth(292) > 507, "the cap would bite on a phone that fits");
  });

  it("bites on the short phone it exists for", () => {
    // 375x553 leaves ~131 once the air has closed up; 130vw there is 487.
    assert.ok(bandCapWidth(131) < 487, "the cap does not bite where it must");
  });
});

it("the constants the stylesheet also hard-codes are stated once here", () => {
  assert.equal(AIR_FULL_AT, 844);
  assert.equal(AIR_FLOOR, 0.55);
});
