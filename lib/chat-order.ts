/**
 * The order a chat is READ in — oldest at the top, newest at the bottom —
 * regardless of the order a page arrives in.
 *
 * `GET /streams/{id}/chat` is a HISTORY page: it answers newest first, with a
 * cursor that walks further back. That is the right shape for "load what was
 * said before", and the wrong shape to draw as-is — drawn in page order the
 * newest message sat at the TOP and the pin-to-bottom logic followed the
 * oldest one (ogazboiz, 2026-09-13: "let recent message be at the bottom …
 * old messages should be scrolling up just like how live messages is").
 *
 * So every page, live or historical, goes through here before it is drawn:
 * merged, de-duplicated by id (a message can sit in the polled head AND in
 * the history page that was fetched a moment earlier), and sorted by the
 * time it was sent. The id breaks ties because ids are time-ordered UUIDs
 * here and two messages in one millisecond must still draw in one order.
 */
export interface ChatOrderable {
  id: string;
  createdAt: string;
}

/** Oldest first. Stable for equal timestamps, de-duplicated by id, input untouched. */
export function oldestFirst<T extends ChatOrderable>(...pages: readonly (readonly T[])[]): T[] {
  const byId = new Map<string, T>();
  for (const page of pages) for (const item of page) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => {
    const at = Date.parse(a.createdAt);
    const bt = Date.parse(b.createdAt);
    if (at !== bt) return (Number.isNaN(at) ? 0 : at) - (Number.isNaN(bt) ? 0 : bt);
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * How close to the top counts as "asking for older". 80px rather than 0: a
 * reader flicking upward reaches the top at speed and the page should already
 * be on its way, not start when they bump the edge and stop.
 */
export const OLDER_THRESHOLD_PX = 80;

/**
 * The scroll offset that keeps the reader on the same message after older
 * messages were inserted ABOVE them: the list grew by `grownBy`, so the same
 * content now sits that much further down.
 */
export function preservedScrollTop(previousTop: number, previousHeight: number, nextHeight: number): number {
  return previousTop + Math.max(0, nextHeight - previousHeight);
}
