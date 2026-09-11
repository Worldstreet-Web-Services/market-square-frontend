/**
 * WHERE HOME'S FRIENDS DECK'S CARDS SIT — node 844:18440 (the file's "Home"
 * frame), in the file's own units. Pure, so every number here can be checked against the
 * file without a browser (`lib/deck-layout.test.ts`).
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
  arrow: { size: number; dy: number; leftDx: number; rightDx: number };
  places: Record<number, DeckPlace>;
  /**
   * The deck box's vertical extent from the front card's centre, when the back
   * cards run past the front card's own height. Absent: the box IS the front
   * card, as on `/pals`.
   */
  box?: { top: number; bottom: number };
}

export const DECK_NODE: DeckNode = {
  /** 844:23435 — the front card, the unit everything else is measured in. */
  card: { width: 543.42, height: 718 },
  /** The fan's own extent from the front card's centre: the left card's box edge (4134) to the right card's (5077). */
  fan: { left: -465.55, right: 477.45 },
  /** 844:22642 / 844:22639 — 64 discs centred 29 below the front card's centre, at -444.55 and +408.45. */
  arrow: { size: 64, dy: 29, leftDx: -444.55, rightDx: 408.45 },
  places: {
    /** 850:23475 — box 510.68 × 635.33 at 4134, 49467; size 444.01 × 586.65. */
    [-1]: { dx: -210.21, dy: 0.67, scale: 0.8171, rot: -6.836, opacity: 0.39 },
    0: { dx: 0, dy: 0, scale: 1, rot: 0, opacity: 1 },
    /** 855:23614 — box 577.92 × 684.92 at 4499, 49439; size 451.06 × 595.96. */
    1: { dx: 188.41, dy: -2.54, scale: 0.83, rot: 13.524, opacity: 0.3 },
  } as Record<number, DeckPlace>,
};

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
  /** The left card's box edge (138.12) to the right card's (957.18), from the front card's centre (524.17). */
  fan: { left: -386.05, right: 433.06 },
  /** 695:27703 / 695:27693 — 64 discs centred 15.88 below the front card's centre, at -357.17 and +412.83. */
  arrow: { size: 64, dy: 15.88, leftDx: -357.17, rightDx: 412.83 },
  places: {
    /** 647:16314 — size 287.79 x 391.69, turned -9.274deg. */
    [-1]: { dx: -212.47, dy: 5.71, scale: 0.9276, rot: -9.274, opacity: 0.2 },
    0: { dx: 0, dy: 0, scale: 1, rot: 0, opacity: 1 },
    /** 647:16301 — size 287.79 x 391.69, turned 9.904deg. */
    1: { dx: 257.62, dy: 12.02, scale: 0.9276, rot: 9.904, opacity: 0.2 },
  },
  /** The group 647:16300 runs from the front card's top to 229.70 below its centre. */
  box: { top: -211.12, bottom: 229.7 },
};

/** The deck's full extent from the front card's centre, with or without the step discs. */
export function deckExtent(arrows: boolean, node: DeckNode = DECK_NODE): { left: number; right: number } {
  const discLeft = node.arrow.leftDx - node.arrow.size / 2;
  const discRight = node.arrow.rightDx + node.arrow.size / 2;
  return {
    left: arrows ? Math.min(node.fan.left, discLeft) : node.fan.left,
    right: arrows ? Math.max(node.fan.right, discRight) : node.fan.right,
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
