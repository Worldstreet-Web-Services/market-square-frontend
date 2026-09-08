import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deckShift } from "./deck-centring.ts";

/** The file's own three, node 225:3374 — see DECK_PLACES in the deck. */
const LEFT = -129.32;
const FRONT = -14.09;
const RIGHT = 128.21;

describe("deckShift", () => {
  it("leaves the file's full three-card composition alone", () => {
    assert.equal(deckShift({ fill: false, offsets: [LEFT, FRONT, RIGHT], frontX: FRONT }), 0);
  });

  it("centres a short fan on the cards it actually drew", () => {
    // Two cards at the front and right slots sit right of the row's middle;
    // the shift is what brings their mean back to zero.
    const shift = deckShift({ fill: false, offsets: [FRONT, RIGHT], frontX: FRONT });
    const mean = (FRONT + shift + (RIGHT + shift)) / 2;
    assert.ok(Math.abs(mean) < 1e-9, `short fan still lopsided by ${mean}`);
  });

  it("centres a single card exactly", () => {
    assert.equal(deckShift({ fill: false, offsets: [FRONT], frontX: FRONT }) + FRONT, 0);
  });

  it("centres the FRONT card when filling, not the group", () => {
    // The bug this exists for: returning 0 here left the card being decided
    // about 14.09 file units (~20px at the 1.45 fill scale) left of centre.
    const shift = deckShift({ fill: true, offsets: [LEFT, FRONT, RIGHT], frontX: FRONT });
    assert.equal(FRONT + shift, 0, "the front card is off-centre on /pals again");
  });

  it("centres the front card when filling even with a short fan", () => {
    const shift = deckShift({ fill: true, offsets: [FRONT], frontX: FRONT });
    assert.equal(FRONT + shift, 0);
  });

  it("does not divide by zero on an empty fan", () => {
    assert.equal(deckShift({ fill: false, offsets: [], frontX: FRONT }), 0);
  });
});
