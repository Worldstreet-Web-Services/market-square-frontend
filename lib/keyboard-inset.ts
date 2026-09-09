/**
 * HOW MUCH OF THE WINDOW THE ON-SCREEN KEYBOARD IS COVERING.
 *
 * ─── WHY THIS EXISTS WHEN THE VIEWPORT META ALREADY SAYS `resizes-content` ──
 * `interactive-widget=resizes-content` (app/layout.tsx) makes the keyboard
 * SHRINK the layout viewport, so `100dvh` gets smaller and a pinned composer
 * stays above it with no JavaScript at all. That is the whole fix — on
 * Chromium. **iOS Safari does not implement `interactive-widget`.** There the
 * layout viewport does not move: Safari shrinks the VISUAL viewport and
 * scrolls it, so a composer pinned to the foot of a `100dvh` pane sits under
 * the keyboard and the "pinned" pane scrolls. That is the bug ogazboiz
 * reported on a real phone — the thread scrolled and the composer could not be
 * reached — and no amount of `dvh` fixes it, because `dvh` is already correct
 * about a viewport that genuinely has not changed size.
 *
 * So the inset is measured from `window.visualViewport` and subtracted by
 * hand. On Chromium it computes to ZERO by construction — the layout viewport
 * shrank with the visual one, so their difference is nothing — which is what
 * makes it safe to apply everywhere rather than sniffing for a browser.
 *
 * ─── THE ARITHMETIC ─────────────────────────────────────────────────────────
 * `visualViewport.height` is what the reader can see; `offsetTop` is how far
 * the visual viewport has been scrolled down inside the layout one. What the
 * keyboard covers is therefore everything below the visible band:
 *
 *     inset = layoutHeight - (visualHeight + offsetTop)
 *
 * Pure and separate from the DOM so the cases that are awkward to reproduce in
 * a browser — a pinch-zoomed page, a keyboard mid-animation, a browser that
 * reports nothing — can be pinned in `lib/keyboard-inset.test.ts`.
 */

/**
 * Below this many pixels the difference is not a keyboard.
 *
 * A pinch-zoom, an iOS URL bar collapsing, or a keyboard part-way through its
 * animation all produce small non-zero differences, and letting those through
 * makes the thread twitch while somebody is reading it. No on-screen keyboard
 * is anywhere near this short, so the floor costs nothing real.
 */
export const KEYBOARD_MIN = 80;

export function keyboardInset({
  layoutHeight,
  visualHeight,
  offsetTop = 0,
}: {
  /** `window.innerHeight` — the layout viewport. */
  layoutHeight: number;
  /** `visualViewport.height`. */
  visualHeight: number;
  /** `visualViewport.offsetTop`. */
  offsetTop?: number;
}): number {
  if (
    !Number.isFinite(layoutHeight) ||
    !Number.isFinite(visualHeight) ||
    !Number.isFinite(offsetTop)
  ) {
    return 0;
  }
  const covered = layoutHeight - (visualHeight + offsetTop);
  // Negative means the visual viewport is somehow TALLER than the layout one.
  // That happens transiently on rotation; it is never a keyboard.
  if (!Number.isFinite(covered) || covered < KEYBOARD_MIN) return 0;
  // Rounded, because a fractional pixel here becomes a fractional pixel of
  // layout that the browser will round its own way every frame.
  return Math.round(covered);
}

/**
 * THE HEIGHT ACTUALLY VISIBLE TO THE READER, which is a different question
 * from "how much is the keyboard covering" and a better one to size a pinned
 * pane by.
 *
 * `100dvh` is the DYNAMIC viewport, and on a phone it tracks a URL bar that
 * slides in and out — so a pane sized in `dvh` is correct only at the instant
 * the browser last recomputed it, and is short or long by the bar's height in
 * between. That is the vertical scroll and the band of dead space below the
 * composer that ogazboiz reported, on a layout whose arithmetic measures
 * EXACTLY right in an emulated browser: the calc was never wrong, the unit was
 * telling the truth about a viewport that had already moved on.
 *
 * `visualViewport.height` is not a prediction. It is what is on the glass,
 * right now, with the URL bar and the keyboard both already accounted for —
 * which is why this replaces `100dvh` rather than being subtracted from it.
 * Subtracting `keyboardInset` from it as well would count the keyboard twice.
 *
 * Zero is returned rather than a guess when there is nothing to measure, and
 * the caller falls back to `100dvh` — the old behaviour, which is correct on
 * a desktop and merely imprecise on a phone.
 */
export function visibleHeight(visualHeight: number): number {
  if (!Number.isFinite(visualHeight) || visualHeight <= 0) return 0;
  return Math.round(visualHeight);
}
