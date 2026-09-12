import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anchorAbove, anchorBelow, placeAnchored } from "./anchored-popover.ts";

const viewport = { width: 1200, height: 800 };

describe("anchorAbove", () => {
  it("lines the panel up with the chosen trigger edge", () => {
    const trigger = { left: 500, right: 528, top: 600 };
    assert.equal(anchorAbove({ trigger, width: 264, viewport, align: "left" }).left, 500);
    assert.equal(anchorAbove({ trigger, width: 264, viewport, align: "right" }).left, 264);
  });

  it("sits above the trigger with a gap", () => {
    const { bottom } = anchorAbove({
      trigger: { left: 10, right: 38, top: 600 },
      width: 264,
      viewport,
      align: "left",
    });
    assert.equal(bottom, 208); // 800 - 600 + 8
  });

  it("keeps a margin at both edges", () => {
    // Trigger hard against the right edge: the panel pulls back inside.
    const right = anchorAbove({
      trigger: { left: 1180, right: 1198, top: 400 },
      width: 264,
      viewport,
      align: "left",
    });
    assert.equal(right.left, 1200 - 264 - 12);
    // ...and against the left edge, aligned right, it cannot go negative.
    const left = anchorAbove({
      trigger: { left: 4, right: 32, top: 400 },
      width: 264,
      viewport,
      align: "right",
    });
    assert.equal(left.left, 12);
  });

  it("pins a panel wider than the viewport to the left margin", () => {
    const { left } = anchorAbove({
      trigger: { left: 100, right: 128, top: 400 },
      width: 900,
      viewport: { width: 380, height: 700 },
      align: "left",
    });
    assert.equal(left, 12);
  });

  it("never lets the panel run off the top", () => {
    const { bottom } = anchorAbove({
      trigger: { left: 100, right: 128, top: 790 },
      width: 264,
      viewport,
      align: "left",
    });
    assert.equal(bottom, Math.max(12, 800 - 790 + 8));
  });
});

describe("anchorBelow", () => {
  const viewport = { width: 1440, height: 900 };
  it("hangs under the trigger's bottom edge, aligned to the chosen edge", () => {
    const at = anchorBelow({
      trigger: { left: 900, right: 938, top: 400, bottom: 438 },
      width: 231,
      viewport,
      align: "right",
      gap: 4,
    });
    assert.deepEqual(at, { left: 707, top: 442 });
  });
  it("keeps the margin when the trigger sits at the viewport's edge", () => {
    const at = anchorBelow({
      trigger: { left: 1420, right: 1440, top: 10, bottom: 30 },
      width: 231,
      viewport,
      align: "right",
    });
    assert.equal(at.left, 1440 - 231 - 12);
    assert.equal(at.top, 38);
  });
});

describe("placeAnchored", () => {
  const viewport = { width: 1440, height: 900 };
  const field = { left: 100, right: 700, top: 800, bottom: 840 };

  it("opens above when the panel fits above the field", () => {
    const at = placeAnchored({ trigger: field, width: 600, height: 256, viewport, align: "left" });
    assert.equal(at.side, "above");
    assert.deepEqual(at, { side: "above", left: 100, bottom: 900 - 800 + 8 });
  });

  it("flips below when the space above is less than the panel's height", () => {
    const high = { left: 100, right: 700, top: 120, bottom: 160 };
    const at = placeAnchored({ trigger: high, width: 600, height: 256, viewport, align: "left" });
    assert.equal(at.side, "below");
    assert.deepEqual(at, { side: "below", left: 100, top: 168 });
  });

  it("counts the gap and the margin as space the panel cannot use", () => {
    // 256 of panel needs 256 + 8 gap + 12 margin = 276 above the field's top.
    const exact = { left: 0, right: 300, top: 276, bottom: 300 };
    assert.equal(placeAnchored({ trigger: exact, width: 300, height: 256, viewport, align: "left" }).side, "above");
    const short = { left: 0, right: 300, top: 275, bottom: 300 };
    assert.equal(placeAnchored({ trigger: short, width: 300, height: 256, viewport, align: "left" }).side, "below");
  });
});
