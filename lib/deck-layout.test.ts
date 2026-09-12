import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DECK_NODE, HOME_DECK_NODE, PALS_PAGE, deckLayout, rotatedBox } from "./deck-layout.ts";

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

/**
 * `/pals`' CURRENT NODE, 1328:1885: its deck group 1331:21321 is 596 wide and
 * every box in it is 844:18440's at 0.6248. These are the node's own readings
 * (`size` and `relativeTransform` from REST `geometry=paths`), and the deck
 * laid out in a 596 room has to reproduce them — or the node is a second
 * drawing and needs its own `DeckNode`.
 */
describe("node 1328:1885's deck is DECK_NODE at 0.6248, in a 596 room", () => {
  const room = 596;
  const layout = deckLayout({ room, arrows: true });
  const { k } = layout;

  it("scales by the node's own factor", () => {
    close(k, 0.6248, 0.0002, "k");
  });

  it("draws the front card 1331:21353 at 339.53 x 448.60, 127.99 in", () => {
    close(DECK_NODE.card.width * k, 339.53, 0.1, "front width");
    close(DECK_NODE.card.height * k, 448.6, 0.1, "front height");
    close(layout.height, 448.6, 0.1, "deck box height");
    close(layout.frontX - (DECK_NODE.card.width / 2) * k, 127.99, 0.1, "front card's left edge");
  });

  it("draws the back cards at the node's sizes and tilts — 1331:21339 and 1331:21322", () => {
    const left = DECK_NODE.places[-1]!;
    const right = DECK_NODE.places[1]!;
    close(DECK_NODE.card.width * left.scale * k, 277.41, 0.1, "left width");
    close(DECK_NODE.card.height * left.scale * k, 366.53, 0.1, "left height");
    close(DECK_NODE.card.width * right.scale * k, 281.82, 0.1, "right width");
    close(DECK_NODE.card.height * right.scale * k, 372.35, 0.1, "right height");
    // The node's rotated boxes, which are NOT the sizes: 319.07 x 396.95 and 361.08 x 427.93.
    const leftBox = rotatedBox(DECK_NODE.card.width * left.scale * k, DECK_NODE.card.height * left.scale * k, left.rot);
    const rightBox = rotatedBox(DECK_NODE.card.width * right.scale * k, DECK_NODE.card.height * right.scale * k, right.rot);
    close(leftBox.width, 319.07, 0.1, "left box width");
    close(leftBox.height, 396.95, 0.1, "left box height");
    close(rightBox.width, 361.08, 0.1, "right box width");
    close(rightBox.height, 427.93, 0.1, "right box height");
  });

  it("puts the 39.99 discs 1331:21381 / 1331:21336 at (0, 222.43) and (532.95, 222.43)", () => {
    const { arrow } = DECK_NODE;
    close(arrow.size * k, 39.99, 0.05, "disc size");
    close(layout.frontX + (arrow.leftDx - arrow.size / 2) * k, 0, 0.05, "left disc's left");
    close(layout.frontX + (arrow.rightDx - arrow.size / 2) * k, 532.95, 0.1, "right disc's left");
    close(layout.frontY + (arrow.dy - arrow.size / 2) * k, 222.43, 0.1, "discs' top");
    assert.equal(arrow.lens, "sampled", "the discs lost the node's measured glass");
  });

  it("spaces the pill, the deck and the heading as the node does", () => {
    close(PALS_PAGE.groupLeft * k, 15, 0.05, "the group's inset past the deck");
    close(PALS_PAGE.groupRight * k, 2, 0.05, "the group's right edge inside the deck's");
    close(PALS_PAGE.pillToDeck * k, 45, 0.05, "pill to deck");
    close(PALS_PAGE.deckToHeading * k, 177.4, 0.05, "deck to heading");
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

/**
 * HOME'S OWN DECK — node 647:16300 in the live file (647:16288, updated
 * 2026-09-10). Its numbers are the nodes' size and relativeTransform; these
 * boxes are what Figma reports, and the two must round-trip.
 */
describe("Home's own deck — node 647:16300", () => {
  const H = HOME_DECK_NODE;
  const LEFT_BOX = { width: 347.15, height: 432.95 };
  const RIGHT_BOX = { width: 350.87, height: 435.35 };

  it("its back cards turned by their rotations give back the file's boxes", () => {
    for (const [box, place] of [
      [LEFT_BOX, H.places[-1]!],
      [RIGHT_BOX, H.places[1]!],
    ] as const) {
      const size = rotatedBox(H.card.width * place.scale, H.card.height * place.scale, place.rot);
      close(size.width, box.width, 0.1, "box width");
      close(size.height, box.height, 0.1, "box height");
    }
  });

  it("dims both back cards to the node's 20%", () => {
    assert.equal(H.places[-1]!.opacity, 0.2);
    assert.equal(H.places[1]!.opacity, 0.2);
  });

  const room = 575;
  const layout = deckLayout({ room, arrows: true, node: H });
  const edge = (dx: number, half: number, side: 1 | -1) => layout.frontX + (dx + side * half) * layout.k;

  it("fits the fan and both discs in the column, cutting nothing", () => {
    close(edge(H.arrow.leftDx, H.arrow.size / 2, -1), 0, 1e-6, "left disc");
    close(edge(H.arrow.rightDx, H.arrow.size / 2, 1), room, 1e-6, "right disc");
    for (const [dx, half] of [
      [H.places[-1]!.dx, LEFT_BOX.width / 2],
      [H.places[1]!.dx, RIGHT_BOX.width / 2],
      [0, H.card.width / 2],
    ] as const) {
      assert.ok(edge(dx, half, -1) >= -0.1 && edge(dx, half, 1) <= room + 0.1, `something at dx ${dx} runs past the column`);
    }
  });

  it("is the group's own height, with the front card's top on the box's top", () => {
    close(layout.frontY - (H.card.height / 2) * layout.k, 0, 1e-9, "front card top");
    close(layout.height, (229.7 + 211.12) * layout.k, 1e-9, "height");
  });
});
