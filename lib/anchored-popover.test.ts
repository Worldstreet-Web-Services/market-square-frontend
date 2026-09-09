import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anchorAbove } from "./anchored-popover.ts";

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
