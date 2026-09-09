import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DECK_NODE, deckLayout, rotatedBox } from "./deck-layout.ts";

/**
 * The file's own boxes, node 844:18440. The deck stores SIZES and ROTATIONS;
 * these are what Figma reports, and the two must round-trip or a number was
 * read off the wrong field.
 */
const FRONT = DECK_NODE.card;
const LEFT = { box: { width: 510.68, height: 635.33 }, place: DECK_NODE.places[-1]! };
const RIGHT = { box: { width: 577.92, height: 684.92 }, place: DECK_NODE.places[1]! };

const close = (a: number, b: number, tol: number, what: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not within ${tol} of ${b}`);

describe("the back cards' sizes are solved from their rotated boxes", () => {
  for (const [name, { box, place }] of [
    ["left 850:23475", LEFT],
    ["right 855:23614", RIGHT],
  ] as const) {
    it(`${name}: size turned by its rotation gives back the file's box`, () => {
      const size = rotatedBox(FRONT.width * place.scale, FRONT.height * place.scale, place.rot);
      close(size.width, box.width, 0.1, `${name} box width`);
      close(size.height, box.height, 0.1, `${name} box height`);
    });
    it(`${name}: is SMALLER than the front card, though its box is wider than the card itself`, () => {
      // The trap: the box reads wider than the card it belongs to (and, on the
      // right, wider than the FRONT card), so read as a size it says "bigger".
      assert.ok(box.width > FRONT.width * place.scale, "the box is no longer wider than its card");
      assert.ok(place.scale < 1, `scaled to ${place.scale}`);
    });
  }

  it("the 109.38 control discs turned 17.773° are the file's 137.55 boxes", () => {
    close(rotatedBox(109.38, 109.38, 17.773).width, 137.55, 0.05, "disc box");
  });

  it("dims the two behind by the node's own opacity, and only those", () => {
    assert.equal(LEFT.place.opacity, 0.39);
    assert.equal(RIGHT.place.opacity, 0.3);
    assert.equal(DECK_NODE.places[0]!.opacity, 1);
  });
});

describe("deckLayout, wide", () => {
  const room = 552;
  const layout = deckLayout({ room, wide: true });

  it("fits the file's 917 span to the column", () => {
    close(layout.k, room / 917, 1e-9, "k");
  });

  it("lands the step discs on the column's edges with the front card where the file puts it", () => {
    close(layout.frontX + DECK_NODE.span.left * layout.k, 0, 1e-6, "left disc's outer edge");
    close(layout.frontX + DECK_NODE.span.right * layout.k, room, 1e-6, "right disc's outer edge");
    // 11 file units right of the middle — the file's hand, not a formula.
    assert.ok(layout.frontX > room / 2, "the front card lost the file's placement in the span");
  });

  it("is as tall as the front card, and the tilted cards fit inside that", () => {
    close(layout.height, FRONT.height * layout.k, 1e-9, "height");
    for (const { box, place } of [LEFT, RIGHT]) {
      assert.ok(Math.abs(place.dy) + box.height / 2 <= FRONT.height / 2, "a back card runs past the box");
    }
  });
});

describe("deckLayout, phone", () => {
  const room = 358;
  const layout = deckLayout({ room, wide: false });
  const frontLeft = layout.frontX - (FRONT.width / 2) * layout.k;
  const frontRight = layout.frontX + (FRONT.width / 2) * layout.k;

  it("gives the front card its share of the column, centred", () => {
    close(frontRight - frontLeft, DECK_NODE.phoneFrontShare * room, 1e-6, "front card width");
    close(layout.frontX, room / 2, 1e-9, "centre");
  });

  it("keeps both back cards peeking beside the front card and bleeding off the edges", () => {
    const leftOuter = layout.frontX + (LEFT.place.dx - LEFT.box.width / 2) * layout.k;
    const rightOuter = layout.frontX + (RIGHT.place.dx + RIGHT.box.width / 2) * layout.k;
    assert.ok(leftOuter < 0, "the left card no longer bleeds off the column");
    assert.ok(rightOuter > room, "the right card no longer bleeds off the column");
    assert.ok(frontLeft > 0 && frontRight < room, "nothing is left beside the front card to peek in");
  });
});
