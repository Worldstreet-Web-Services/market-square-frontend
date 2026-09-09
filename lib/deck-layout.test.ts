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

describe("deckLayout, with the step discs", () => {
  const room = 552;
  const layout = deckLayout({ room, arrows: true });
  const edge = (dx: number, halfBox: number, side: 1 | -1) => layout.frontX + (dx + side * halfBox) * layout.k;

  it("fits the whole extent — the left disc to the right card's box edge — in the column", () => {
    close(layout.k, room / 954, 1e-9, "k");
    close(edge(DECK_NODE.arrow.leftDx, DECK_NODE.arrow.size / 2, -1), 0, 1e-6, "left disc's outer edge");
    // 0.1: the boxes here are the file's two-decimal readings.
    close(edge(RIGHT.place.dx, RIGHT.box.width / 2, 1), room, 0.1, "right card's box edge");
  });

  it("cuts nothing: every card and disc lies inside the box", () => {
    for (const [dx, half] of [
      [LEFT.place.dx, LEFT.box.width / 2],
      [RIGHT.place.dx, RIGHT.box.width / 2],
      [0, FRONT.width / 2],
      [DECK_NODE.arrow.leftDx, DECK_NODE.arrow.size / 2],
      [DECK_NODE.arrow.rightDx, DECK_NODE.arrow.size / 2],
    ] as const) {
      assert.ok(edge(dx, half, -1) >= -0.1 && edge(dx, half, 1) <= room + 0.1, `something at dx ${dx} runs past the column`);
    }
  });

  it("keeps the right disc INSIDE the fan, over the right card, as the file draws it", () => {
    assert.ok(edge(DECK_NODE.arrow.rightDx, DECK_NODE.arrow.size / 2, 1) < room, "the right disc was pushed to the column's edge");
  });

  it("is as tall as the front card, and the tilted cards fit inside that", () => {
    close(layout.height, FRONT.height * layout.k, 1e-9, "height");
    for (const { box, place } of [LEFT, RIGHT]) {
      assert.ok(Math.abs(place.dy) + box.height / 2 <= FRONT.height / 2, "a back card runs past the box");
    }
  });
});

describe("deckLayout, without the step discs (phone)", () => {
  const room = 356;
  const layout = deckLayout({ room, arrows: false });

  it("fits the fan alone — both back cards' box edges on the column's edges", () => {
    close(layout.k, room / 943, 1e-9, "k");
    close(layout.frontX + (LEFT.place.dx - LEFT.box.width / 2) * layout.k, 0, 0.1, "left card's box edge");
    close(layout.frontX + (RIGHT.place.dx + RIGHT.box.width / 2) * layout.k, room, 0.1, "right card's box edge");
  });
});
