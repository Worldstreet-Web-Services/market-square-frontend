/**
 * WHERE FOCUS GOES WHEN THE THING HOLDING IT GOES AWAY.
 *
 * A focused element that unmounts (an answered invitation banner, an invited
 * row whose Cancel was pressed, a sheet row swapped for another) drops a
 * keyboard or screen-reader user on <body>: at the top of the document, and
 * outside any modal sheet they were in. These are the decisions; the DOM is
 * handed in, so node --test can pin them.
 */

export interface FocusHolder {
  isConnected: boolean;
}

export interface FocusTarget extends FocusHolder {
  focus(options?: { preventScroll?: boolean }): void;
}

/** Nothing holds focus, the body does, or the element that did has been removed. */
export function focusLost(active: FocusHolder | null | undefined, body: unknown): boolean {
  return !active || active === body || !active.isConnected;
}

/**
 * Focus the first candidate still on the page — only if focus was lost. Focus
 * the reader moved somewhere on purpose is left where it is.
 */
export function handFocusOn<T extends FocusTarget>(
  active: FocusHolder | null | undefined,
  body: unknown,
  candidates: readonly (T | null | undefined)[]
): T | null {
  if (!focusLost(active, body)) return null;
  const target = candidates.find((candidate): candidate is T => !!candidate && candidate.isConnected);
  if (!target) return null;
  target.focus({ preventScroll: true });
  return target;
}

/** A removed row at `index` of what is now `count` rows: the row that took its place, else the last one. */
export function nextFocusIndex(index: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.min(index, count - 1);
}
