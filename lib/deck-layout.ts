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
 * ─── THE STEP DISCS SPAN THE COLUMN ─────────────────────────────────────────
 * The `<` and `>` discs (844:22642, 844:22639) are 64 wide at x 4123 and 4976,
 * their centres 29 BELOW the front card's centre. Outer edge to outer edge they
 * span 917, which is the design's column (the heading's back disc starts at
 * 4131 and the Location pill ends at 5046). So at a desktop width the deck is
 * that span scaled to our column: `k = room / 917`, and the discs land on the
 * column's edges with the front card 476.55k in from the left — the file's own
 * placement, which is 11 units right of the column's middle.
 *
 * ─── THE PHONE IS DERIVED, NOT DRAWN ────────────────────────────────────────
 * No mobile frame was given for this deck. At `k = room / 917` a 358px
 * column gives a 212px card — a thumbnail marooned in a phone. So below the `md` split the FRONT card is scaled to a share
 * of the column (`phoneFrontShare`, 80%: a 286px card on a 358px column) and
 * the two behind keep their file offsets, scales, tilts and opacities relative
 * to it, so they bleed off both edges and peek beside the front card in the
 * remaining 10% each side. The share is a judgement, stated here once; every
 * other number is the node's.
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

export const DECK_NODE = {
  /** 844:23435 — the front card, the unit everything else is measured in. */
  card: { width: 543.42, height: 718 },
  /** Outer edges of the two step discs, from the front card's centre: 4123 and 5040 against 4599.55. */
  span: { left: -476.55, right: 440.45 },
  /** 844:22642 / 844:22639 — 64 discs, centred 29 below the front card's centre. */
  arrow: { size: 64, dy: 29 },
  places: {
    /** 850:23475 — box 510.68 × 635.33 at 4134, 49467; size 444.01 × 586.65. */
    [-1]: { dx: -210.21, dy: 0.67, scale: 0.8171, rot: -6.836, opacity: 0.39 },
    0: { dx: 0, dy: 0, scale: 1, rot: 0, opacity: 1 },
    /** 855:23614 — box 577.92 × 684.92 at 4499, 49439; size 451.06 × 595.96. */
    1: { dx: 188.41, dy: -2.54, scale: 0.83, rot: 13.524, opacity: 0.3 },
  } as Record<number, DeckPlace>,
  /** Below `md`: how much of the column the front card takes. A judgement — see above. */
  phoneFrontShare: 0.8,
};

export interface DeckLayout {
  /** Screen pixels per file unit. */
  k: number;
  /** The front card's centre, from the deck box's left edge, in screen pixels. */
  frontX: number;
  /** The deck box's height in screen pixels — the front card's; the tilted cards fit inside it. */
  height: number;
}

/**
 * Scale and centring for a deck box `room` pixels wide.
 *
 * `wide` is the shell's phone/desktop split (`md`). Wide, the file's 917 span
 * is fitted to the column and the front card sits where the file puts it in
 * that span. Narrow, the front card takes `phoneFrontShare` of the column and
 * is centred — the file's asymmetry is a 24-unit hand placement relative to
 * two discs that a phone's Home does not draw.
 */
export function deckLayout({ room, wide }: { room: number; wide: boolean }): DeckLayout {
  const span = DECK_NODE.span.right - DECK_NODE.span.left;
  const k = wide ? room / span : (DECK_NODE.phoneFrontShare * room) / DECK_NODE.card.width;
  const frontX = wide ? -DECK_NODE.span.left * k : room / 2;
  return { k, frontX, height: DECK_NODE.card.height * k };
}

/** The axis-aligned box a `width` × `height` node needs once turned by `deg` — what Figma reports as its bounding box. */
export function rotatedBox(width: number, height: number, deg: number): { width: number; height: number } {
  const t = Math.abs((deg * Math.PI) / 180);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { width: width * c + height * s, height: width * s + height * c };
}
