/**
 * SWIPE A MESSAGE TO REPLY TO IT.
 *
 * Replying on a phone was a two-step gesture nobody would guess: hold the
 * bubble for 450ms, wait for a 28px disc to appear, then hit it. The disc is
 * `[@media(hover:none)]:hidden` the rest of the time, so on touch there was
 * effectively no reply at all until you already knew the trick.
 *
 * This is the gesture people already have in their hands from every other
 * messenger: drag the bubble to the right, let go, reply.
 *
 * Pure, because the part that goes wrong is arithmetic — when a drag counts
 * as a reply rather than a scroll — and that cannot be tested in a browser
 * without a finger.
 */

/** How far the drag must reach before letting go sends a reply. */
export const SWIPE_TRIGGER = 56;

/** The furthest the row is ever drawn, however hard somebody pulls. */
export const SWIPE_MAX = 72;

/**
 * How much horizontal movement must beat vertical before this is a reply.
 *
 * THE WHOLE POINT: a thread's main gesture is SCROLLING, and a finger
 * travelling up the screen always drifts sideways a little. Claiming that
 * drift as a swipe makes the thread feel stuck, which is a far worse failure
 * than a reply that needs a second try. So horizontal has to win clearly.
 */
export const SWIPE_AXIS_RATIO = 1.5;

/**
 * Is this drag a reply gesture rather than a scroll?
 *
 * Rightward only, on every bubble including your own. WhatsApp, Telegram and
 * Signal all pull right regardless of who sent the message, and a direction
 * that flips per bubble is one the hand cannot learn.
 */
export function isReplySwipe(dx: number, dy: number): boolean {
  return dx > 0 && dx > Math.abs(dy) * SWIPE_AXIS_RATIO;
}

/**
 * How far the row is actually drawn for a given drag.
 *
 * It tracks the finger 1:1 up to the trigger, then goes heavy — the row keeps
 * moving so the gesture still feels alive, but it slows and stops well short
 * of anywhere it could be mistaken for a dismissal. The resistance is also
 * what tells the hand, without a word, that the trigger has been passed.
 */
export function swipeOffset(dx: number): number {
  if (dx <= 0) return 0;
  if (dx <= SWIPE_TRIGGER) return dx;
  return Math.min(SWIPE_MAX, SWIPE_TRIGGER + (dx - SWIPE_TRIGGER) * 0.35);
}

/** Does letting go here send a reply? */
export function swipeCommits(dx: number, dy: number): boolean {
  return isReplySwipe(dx, dy) && dx >= SWIPE_TRIGGER;
}
