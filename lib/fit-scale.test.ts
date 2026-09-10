import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fitScale } from "./fit-scale.ts";

/** The friends popup's card, node 647:16629. */
const CARD = { width: 441, height: 472 };

describe("fitScale", () => {
  it("leaves a composition alone when it already fits", () => {
    assert.equal(fitScale({ ...CARD, roomWidth: 900, roomHeight: 800 }), 1);
  });

  it("NEVER scales up, however much room there is", () => {
    // Blown up, a 441-wide modal dominates a desktop page and any non-integer
    // factor makes its text fuzzy.
    assert.equal(fitScale({ ...CARD, roomWidth: 2000, roomHeight: 2000 }), 1);
  });

  it("shrinks to the narrower dimension on a phone", () => {
    // 390 wide, less the overlay's 16px padding either side.
    const s = fitScale({ ...CARD, roomWidth: 358, roomHeight: 700 });
    assert.ok(Math.abs(s - 358 / 441) < 1e-9, `expected width-bound, got ${s}`);
    assert.ok(441 * s <= 358 + 1e-9 && 472 * s <= 700 + 1e-9, "still overflows");
  });

  it("shrinks to HEIGHT when that is the tighter one", () => {
    // A short landscape phone: wide enough, nowhere near tall enough.
    const s = fitScale({ ...CARD, roomWidth: 800, roomHeight: 320 });
    assert.ok(Math.abs(s - 320 / 472) < 1e-9, `expected height-bound, got ${s}`);
    assert.ok(472 * s <= 320 + 1e-9, "still taller than the room");
  });

  it("fits in BOTH directions at once, not just the one it was measured on", () => {
    for (const [w, h] of [[358, 700], [800, 320], [300, 300], [441, 472]]) {
      const s = fitScale({ ...CARD, roomWidth: w, roomHeight: h });
      assert.ok(CARD.width * s <= w + 1e-9 && CARD.height * s <= h + 1e-9, `${w}x${h} overflows`);
    }
  });

  it("stays at 1 before the room has been measured", () => {
    // A callback ref fires with 0 for one frame; scaling to 0 would blank the
    // card, which reads as a broken modal rather than a settling one.
    assert.equal(fitScale({ ...CARD, roomWidth: 0, roomHeight: 0 }), 1);
    assert.equal(fitScale({ ...CARD, roomWidth: Number.NaN, roomHeight: 500 }), 1);
  });

  it("does not divide by a composition with no size", () => {
    assert.equal(fitScale({ width: 0, height: 0, roomWidth: 400, roomHeight: 400 }), 1);
  });
});
