/**
 * WHERE `/pals`' FRIENDS DECK'S CARDS SIT — node 844:18440 (the file's "Home"
 * frame), in the file's own units. Pure, so every number here can be checked against the
 * file without a browser (`lib/deck-layout.test.ts`).
 *
 * ─── `/pals`' CURRENT NODE IS THIS DRAWING AT 0.6248 ────────────────────────
 * 1328:1885 (2026-09-12) draws the deck as group 1331:21321, 596 × 448.60 at
 * (11, 390) — and every one of its numbers is 844:18440's times 0.6248 (the
 * group even reports that factor as its inherited strokeWeight, 0.62479).
 * The front card 1331:21353 is 339.53 × 448.60; the left back card
 * 1331:21339 is 277.41 × 366.53 turned -6.836° at 0.39; the right
 * 1331:21322 is 281.82 × 372.35 turned 13.524° at 0.30; the discs are 39.99,
 * 18.12 below the front card's centre at -277.75 and +255.20. So the node is
 * NOT a second set of numbers: `deckLayout` at a 596 room gives k = 0.6247,
 * and the test pins that the node's own boxes fall out of it. What that node
 * changes is around the deck (`PALS_PAGE`) and in the card (`DECK_CARD`'s
 * rim colour, crown and blink), not the fan.
 *
 * Everything is relative to the FRONT card's centre (844:23435, 543.42 × 718 at
 * 4327.84, 49425 → centre 4599.55, 49784), because the front card is the thing
 * being decided about and the only thing that stays put as the column changes
 * width. The deck renders at these units and is scaled by ONE factor, `k`, so
 * the composition — the sizes, the tilts, the overlap, the discs — is the
 * file's at every width rather than a second set of numbers per breakpoint.
 *
 * ─── A ROTATED NODE'S BOUNDING BOX IS NOT ITS SIZE ──────────────────────────
 * The two back cards report 510.68 × 635.33 (850:23475) and 577.92 × 684.92
 * (855:23614) — the right one WIDER than the 543.42 front card, the left one
 * nearly as wide. Those are the boxes the tilt needs, not the cards: their `size` is 444.01 × 586.65 and
 * 451.06 × 595.96, i.e. the front card at 81.71% and 83.00%. The rotations are
 * -6.836° and +13.524° — Figma's sign is CSS's (positive turns clockwise on
 * screen; the render confirms the right card's top leans right). The test pins
 * the round trip: size turned by rotation gives back the file's box.
 *
 * ─── THEY ARE DIMMED BY NODE OPACITY ────────────────────────────────────────
 * 0.39 on the left card and 0.30 on the right — the whole node, photo and
 * controls included, not a wash over the fill. That is how the file draws
 * depth here: the front card at full strength, the two behind it faded back.
 *
 * ─── NOTHING IS CUT: THE WHOLE FAN FITS THE COLUMN ──────────────────────────
 * The fan's extent is the LEFT card's box edge to the RIGHT card's box edge:
 * 4134 → 5077, i.e. -465.55 to +477.45 from the front card's centre, 943
 * wide. The `<` `>` discs (844:22642, 844:22639 — 64, centred 29 below the
 * front card's centre at -444.55 and +408.45) push the left edge out to 4123,
 * so with them the deck is 954 wide; the right disc sits INSIDE the fan, over
 * the right card, as the file draws it. The scale is whatever fits that whole
 * extent in the column — `k = room / 954` with the discs, `room / 943`
 * without — and the front card sits at its own file offset inside it. The
 * first build fitted the discs' 917 span and let the right card's outer 37
 * units bleed past the column, which the owner read as the card being cut.
 *
 * ─── THE PHONE IS THE SAME RULE, NOT A SECOND SET OF NUMBERS ────────────────
 * No mobile frame was given for this deck. Below `md` there are no discs, so
 * the fan alone fits the column; on a 356 column that is a 205 front card.
 * Nothing bleeds and nothing is clipped at any width.
 */
export interface DeckPlace {
  /** Offset of this card's centre from the front card's centre, file units. */
  dx: number;
  dy: number;
  /** Against the front card's 543.42 × 718 — solved from the rotated box, never read off it. */
  scale: number;
  /** Degrees, CSS sign. */
  rot: number;
  /** The node's own layer opacity. */
  opacity: number;
}

export interface DeckNode {
  card: { width: number; height: number };
  fan: { left: number; right: number };
  arrow: {
    size: number;
    dy: number;
    leftDx: number;
    rightDx: number;
    /** `sampled`: the discs' GLASS as measured on 1328:1885's render (`ws-deck-lens-*`); absent: the sheen Home draws. */
    lens?: "sampled";
  };
  places: Record<number, DeckPlace>;
  /**
   * The deck box's vertical extent from the front card's centre, when the back
   * cards run past the front card's own height. Absent: the box IS the front
   * card, as on `/pals`.
   */
  box?: { top: number; bottom: number };
  /**
   * No right disc: the next card is in the fan but blurred, and going on is
   * the pass or a swipe left. The fan's right reach is then the card's, not
   * the disc's. Home, since 2026-09-12.
   */
  hideNext?: boolean;
}

export const DECK_NODE: DeckNode = {
  /** 844:23435 — the front card, the unit everything else is measured in. */
  card: { width: 543.42, height: 718 },
  /** The fan's own extent from the front card's centre: the left card's box edge (4134) to the right card's (5077). */
  fan: { left: -465.55, right: 477.45 },
  /** 844:22642 / 844:22639 — 64 discs centred 29 below the front card's centre, at -444.55 and +408.45 (1331:21381 / 1331:21336 at 0.6248). */
  arrow: { size: 64, dy: 29, leftDx: -444.55, rightDx: 408.45, lens: "sampled" },
  places: {
    /** 850:23475 — box 510.68 × 635.33 at 4134, 49467; size 444.01 × 586.65. */
    [-1]: { dx: -210.21, dy: 0.67, scale: 0.8171, rot: -6.836, opacity: 0.39 },
    0: { dx: 0, dy: 0, scale: 1, rot: 0, opacity: 1 },
    /** 855:23614 — box 577.92 × 684.92 at 4499, 49439; size 451.06 × 595.96. */
    1: { dx: 188.41, dy: -2.54, scale: 0.83, rot: 13.524, opacity: 0.3 },
  } as Record<number, DeckPlace>,
};

/**
 * WHAT SITS AROUND THE DECK ON `/pals` — node 1328:1885, in the DECK'S units
 * (the node's pixels divided by its 0.6248), so the page scales with the fan
 * by the same `k` and keeps the file's proportions on any column.
 *
 * The deck group 1331:21321 is 596 wide from 11 in. Group 1344:21864 — the
 * Location pill and the heading — is 579 wide from 26 in, so it starts 15
 * past the deck's left edge and ends 2 short of its right. The pill
 * (1344:21865, 86 × 32) is flush right in it at y=313 and the deck's top is
 * y=390: 45 between them. The deck ends at 838.60 and the heading
 * (1344:21868) starts at 1016: 177.40 between.
 */
export const PALS_PAGE = {
  /** 26 - 11, at the node's scale: 15 / 0.6248. */
  groupLeft: 24.01,
  /** (11 + 596) - (26 + 579) = 2, at the node's scale. */
  groupRight: 3.2,
  /** 390 - (313 + 32) = 45, at the node's scale. */
  pillToDeck: 72.02,
  /** 1016 - (390 + 448.60) = 177.40, at the node's scale. */
  deckToHeading: 283.93,
} as const;

export interface DeckLayout {
  /** Screen pixels per file unit. */
  k: number;
  /** The front card's centre, from the deck box's left edge, in screen pixels. */
  frontX: number;
  /** The deck box's height in screen pixels: the front card's, or the node's own `box` when its tilted cards run past it. */
  height: number;
  /** The front card's centre, from the deck box's top edge, in screen pixels. */
  frontY: number;
}

/**
 * HOME'S OWN DECK — node 647:16300 in the live file (647:16288, updated
 * 2026-09-10), in its front card's units (647:16329, 310.24 x 422.24).
 *
 * Not `/pals`' drawing at another scale. Its back cards sit further out and
 * lower, at 0.9276 each and 20% opacity; its discs flank the fan instead of
 * one lying over the right card; and its tilted cards reach 18.58 below the
 * front card, so the box is the group's own height with the front card's top
 * on its top. Offsets, scales and tilts are read from the nodes' `size` and
 * `relativeTransform` (REST `geometry=paths`), never from rotated boxes.
 */
export const HOME_DECK_NODE: DeckNode = {
  card: { width: 310.24, height: 422.24 },
  /*
    HOME'S FAN, TIGHTENED (ogazboiz, 2026-09-12): the file's 647:16300 reaches
    386.05 left and 433.06 right of the front card's centre, with the discs at
    -357.17 and +412.83. The maintainers asked for a bigger front card, the
    next person blurred rather than readable, and no right disc. So the fan
    now reaches 300 each side: the previous card and the left disc on the
    left, the blurred next card on the right, and the front card's centre is
    the column's centre. Each back card sits so its ROTATED box (347.15 and
    350.87 wide) ends exactly on the reach. The cards' own sizes, tilts and
    dimming are the file's; only where they sit and how far the fan reaches
    changed.
  */
  fan: { left: -300, right: 300 },
  arrow: { size: 64, dy: 15.88, leftDx: -268, rightDx: 268 },
  places: {
    /** 647:16314 — size 287.79 x 391.69, turned -9.274deg. */
    [-1]: { dx: -126.4, dy: 5.71, scale: 0.9276, rot: -9.274, opacity: 0.2 },
    0: { dx: 0, dy: 0, scale: 1, rot: 0, opacity: 1 },
    /** 647:16301 — size 287.79 x 391.69, turned 9.904deg. */
    1: { dx: 124.6, dy: 12.02, scale: 0.9276, rot: 9.904, opacity: 0.2 },
  },
  box: { top: -211.12, bottom: 229.7 },
  hideNext: true,
};

/** The deck's full extent from the front card's centre, with or without the step discs. */
export function deckExtent(arrows: boolean, node: DeckNode = DECK_NODE): { left: number; right: number } {
  const discLeft = node.arrow.leftDx - node.arrow.size / 2;
  const discRight = node.arrow.rightDx + node.arrow.size / 2;
  return {
    left: arrows ? Math.min(node.fan.left, discLeft) : node.fan.left,
    right: arrows && !node.hideNext ? Math.max(node.fan.right, discRight) : node.fan.right,
  };
}

/**
 * Scale and centring for a deck box `room` pixels wide: the whole extent —
 * both back cards and, when `arrows` is on, both discs — fits the room, and
 * the front card sits at its own file offset inside it.
 */
export function deckLayout({
  room,
  arrows,
  node = DECK_NODE,
}: {
  room: number;
  arrows: boolean;
  node?: DeckNode;
}): DeckLayout {
  const extent = deckExtent(arrows, node);
  const k = room / (extent.right - extent.left);
  const top = node.box?.top ?? -node.card.height / 2;
  const bottom = node.box?.bottom ?? node.card.height / 2;
  return { k, frontX: -extent.left * k, frontY: -top * k, height: (bottom - top) * k };
}

/** The axis-aligned box a `width` × `height` node needs once turned by `deg` — what Figma reports as its bounding box. */
export function rotatedBox(width: number, height: number, deg: number): { width: number; height: number } {
  const t = Math.abs((deg * Math.PI) / 180);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { width: width * c + height * s, height: width * s + height * c };
}
