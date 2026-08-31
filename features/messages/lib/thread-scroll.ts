/**
 * When the thread should follow new messages.
 *
 * A chat pane lands on the newest message and stays there as more arrive — but
 * only while the reader is already at the live edge. Someone scrolled up
 * reading yesterday must not be yanked to the bottom because a message landed,
 * so "stick to the bottom" is a piece of state that the reader's own scrolling
 * turns off and back on.
 *
 * The measurement is pure and lives here so it can be tested without a DOM.
 */

/** How far from the bottom still counts as being at the bottom.
    A reader is never pixel-exact, and sub-pixel rounding on a zoomed or
    fractional-DPI display leaves a pixel or two behind even when scrolled all
    the way down — a zero threshold would drop out of follow mode on its own. */
export const STICK_THRESHOLD = 80;

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Is the reader at (or close enough to) the live edge?
 *
 * True when the content does not overflow at all: a thread shorter than its
 * pane has no "up" to be scrolled to, so it is always at the bottom and always
 * follows.
 */
export function isAtBottom(
  { scrollTop, scrollHeight, clientHeight }: ScrollMetrics,
  threshold: number = STICK_THRESHOLD
): boolean {
  const distance = scrollHeight - clientHeight - scrollTop;
  // Not `distance <= threshold` alone: over-scroll bounce on iOS reports a
  // NEGATIVE distance, which is still the bottom.
  return distance <= threshold;
}
