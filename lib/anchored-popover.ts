/**
 * Where a panel that opens ABOVE its trigger goes, in viewport coordinates.
 *
 * The pickers used to position themselves with `absolute bottom-full` inside
 * the trigger's own wrapper. That works right up until an ancestor clips: the
 * compose sheet scrolls its body and hides its overflow, so the emoji grid was
 * sliced off at the toolbar and spilled past the sheet's edge — a menu drawn
 * half inside a dialog and half outside it. A fixed-position panel in a portal
 * has no clipping ancestor at all, and this is the arithmetic it needs.
 *
 * Kept pure — the caller reads the DOM and the viewport, this decides. That is
 * what makes the clamping testable, which matters because the failure mode is
 * a panel half off the screen with no way to scroll to it.
 */
export interface AnchorInput {
  /** The trigger's rect, in viewport coordinates. */
  trigger: { left: number; right: number; top: number };
  /** The panel's rendered width. */
  width: number;
  viewport: { width: number; height: number };
  /** Which trigger edge the panel lines up with. */
  align: "left" | "right";
  /** Space between the panel and the trigger. */
  gap?: number;
  /** Space the panel keeps from the viewport edges. */
  margin?: number;
}

export interface AnchorPosition {
  left: number;
  /** Distance from the viewport's BOTTOM, so the panel grows upward. */
  bottom: number;
}

export function anchorAbove({
  trigger,
  width,
  viewport,
  align,
  gap = 8,
  margin = 12,
}: AnchorInput): AnchorPosition {
  const preferred = align === "right" ? trigger.right - width : trigger.left;
  // A panel wider than the viewport pins to the left margin rather than
  // producing a negative maximum and jumping off the other edge.
  const furthestLeft = Math.max(margin, viewport.width - width - margin);
  return {
    left: Math.round(Math.min(Math.max(preferred, margin), furthestLeft)),
    bottom: Math.round(Math.max(margin, viewport.height - trigger.top + gap)),
  };
}

export interface AnchorBelowPosition {
  left: number;
  /** Distance from the viewport's TOP, so the panel hangs downward. */
  top: number;
}

/**
 * The same arithmetic for a panel that opens BELOW its trigger — the
 * profile cover's more menu (545:49822), which used to be `absolute` inside
 * a cover that clips its overflow, so the menu was sliced off at the card's
 * foot. A fixed panel in a portal has no clipping ancestor.
 */
export function anchorBelow({
  trigger,
  width,
  viewport,
  align,
  gap = 8,
  margin = 12,
}: AnchorInput & { trigger: { left: number; right: number; top: number; bottom: number } }): AnchorBelowPosition {
  const preferred = align === "right" ? trigger.right - width : trigger.left;
  const furthestLeft = Math.max(margin, viewport.width - width - margin);
  return {
    left: Math.round(Math.min(Math.max(preferred, margin), furthestLeft)),
    top: Math.round(Math.max(margin, trigger.bottom + gap)),
  };
}

export type AnchoredPlacement =
  | ({ side: "above" } & AnchorPosition)
  | ({ side: "below" } & AnchorBelowPosition);

/**
 * ABOVE by default, BELOW only when there is no room above.
 *
 * Every comment field sits at the foot of something — the card's pill at the
 * bottom of the post, the thread's box at the bottom of its sheet, a composer
 * near the bottom of a phone — so a list that drops down is clipped or pushed
 * off-screen. Opening upward is the rule; the one exception is a field near
 * the TOP of a tall page, where upward would run off the top edge, and there
 * the list hangs below instead. The decision needs the panel's height, which
 * only the caller can measure; the rule itself is here so it can be pinned.
 */
export function placeAnchored({
  trigger,
  width,
  height,
  viewport,
  align,
  gap = 8,
  margin = 12,
}: AnchorInput & {
  trigger: { left: number; right: number; top: number; bottom: number };
  /** The panel's rendered (or maximum) height. */
  height: number;
}): AnchoredPlacement {
  const roomAbove = trigger.top - gap - margin;
  if (roomAbove >= height) {
    return { side: "above", ...anchorAbove({ trigger, width, viewport, align, gap, margin }) };
  }
  return { side: "below", ...anchorBelow({ trigger, width, viewport, align, gap, margin }) };
}
