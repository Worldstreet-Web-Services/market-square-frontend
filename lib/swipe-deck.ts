/**
 * SWIPE-TO-DECIDE — the arithmetic, with no DOM in it.
 *
 * The friends deck is a fanned stack 467px wide with arrows either side. On a
 * phone that is wider than the column, so it sat inside a horizontal scroll:
 * you scrolled sideways through three overlapping cards to reach controls the
 * front card was covering. On the surface whose whole job is deciding about one
 * person at a time.
 *
 * A phone gets ONE card and the gesture every reader already knows — right to
 * follow, left to pass. Kept pure and here because the interesting parts are
 * decisions, not listeners: where the threshold is, when velocity should beat
 * distance, and what a gesture that is mostly vertical means.
 */

/** Past this fraction of the card's width, letting go commits. */
export const COMMIT_RATIO = 0.28;

/**
 * A flick counts even when it is short. Below the distance threshold, this
 * much horizontal speed (px per ms) still commits — otherwise a fast, confident
 * gesture springs back and the deck feels like it is arguing.
 */
export const FLICK_VELOCITY = 0.45;

/** The card leans into the drag. The file has no rotation; this is ours. */
export const MAX_ROTATION_DEG = 12;

/**
 * A gesture steeper than this is the PAGE being scrolled, not a decision.
 * Without it, every vertical scroll that starts on a card drags the card.
 */
export const HORIZONTAL_RATIO = 1.2;

export type SwipeDecision = "follow" | "pass" | null;

/** -1 (fully left) to 1 (fully right). Clamped, so overdrag does not overstate. */
export function swipeProgress(dx: number, width: number): number {
  if (!Number.isFinite(dx) || !(width > 0)) return 0;
  return Math.max(-1, Math.min(1, dx / width));
}

/** Degrees to lean. Proportional to progress so it eases naturally at the edges. */
export function swipeRotation(dx: number, width: number): number {
  return swipeProgress(dx, width) * MAX_ROTATION_DEG;
}

/** Is this drag horizontal enough to be a decision rather than a scroll? */
export function isHorizontalGesture(dx: number, dy: number): boolean {
  return Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO;
}

/**
 * What letting go means.
 *
 * `null` is "spring back" — the default, and deliberately the answer whenever
 * anything is ambiguous. Committing a follow the reader did not mean is a
 * public act performed on their behalf; springing back costs them one more
 * swipe. The asymmetry is the point.
 */
export function swipeDecision(input: {
  dx: number;
  dy: number;
  width: number;
  /** Horizontal px per ms over the tail of the gesture. */
  velocity?: number;
}): SwipeDecision {
  const { dx, dy, width, velocity = 0 } = input;
  if (!Number.isFinite(dx) || !(width > 0)) return null;
  // A mostly-vertical drag is a scroll that happened to start on the card.
  if (!isHorizontalGesture(dx, dy)) return null;

  const far = Math.abs(dx) >= width * COMMIT_RATIO;
  // Velocity must agree with the direction: a fast leftward flick that ends
  // slightly right of centre is a pass, not a follow.
  const flicked = Math.abs(velocity) >= FLICK_VELOCITY && Math.sign(velocity) === Math.sign(dx);
  if (!far && !flicked) return null;
  return dx > 0 ? "follow" : "pass";
}

/** Where the card flies to once committed — off the side it was thrown. */
export function exitOffset(decision: Exclude<SwipeDecision, null>, width: number): number {
  return decision === "follow" ? width * 1.5 : -width * 1.5;
}
