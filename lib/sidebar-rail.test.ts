import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RAIL_DEFAULT,
  RAIL_ICON_W,
  RAIL_MAX_W,
  RAIL_MIN_W,
  clampRail,
  parseRail,
  railFromDrag,
  railWidth,
  toggleRail,
} from "./sidebar-rail.ts";

describe("railFromDrag", () => {
  it("collapses past the snap point and keeps the chosen width", () => {
    const next = railFromDrag(90, { mode: "full", width: 300 });
    assert.deepEqual(next, { mode: "icon", width: 300 });
    // Dragging back out restores the reader's size, not the default.
    assert.equal(railWidth(toggleRail(next)), 300);
  });

  it("clamps a labelled rail to the readable range", () => {
    assert.equal(railFromDrag(1000, RAIL_DEFAULT).width, RAIL_MAX_W);
    assert.equal(railFromDrag(RAIL_MIN_W - 20, RAIL_DEFAULT).width, RAIL_MIN_W);
  });
});

describe("railWidth", () => {
  it("renders the icon width while collapsed", () => {
    assert.equal(railWidth({ mode: "icon", width: 300 }), RAIL_ICON_W);
  });
});

describe("parseRail", () => {
  // Stored state is data written by an older build, never something to trust:
  // a bad width renders a nav wide enough to hide the control that fixes it.
  it("refuses anything that is not a rail", () => {
    for (const raw of [null, "", "{", "null", '"full"', '{"mode":"wide","width":200}', '{"mode":"full"}', '{"mode":"full","width":"200"}']) {
      assert.equal(parseRail(raw), null, `refused ${raw}`);
    }
  });

  it("clamps a width that is out of range", () => {
    assert.deepEqual(parseRail('{"mode":"full","width":4000}'), { mode: "full", width: RAIL_MAX_W });
    assert.deepEqual(parseRail('{"mode":"icon","width":1}'), { mode: "icon", width: clampRail(1) });
  });
});
