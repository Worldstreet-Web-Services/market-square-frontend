"use client";

import { useEffect, useState } from "react";
import { anchorFor, countNew, newAuthors, splitHeld, type FeedLike } from "@/lib/new-posts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * HOLD WHAT ARRIVES ABOVE THE READER — the X "N new posts" pattern.
 *
 * No second query and no poll: `useFeed` already refetches on focus, on
 * remount and after a publish, and each refetch is the signal. The hook keeps
 * an ANCHOR — the id of the first item the reader was shown — and splits each
 * fresh list against it (`splitHeld`): the anchored tail is what they see,
 * anything the server placed above it waits behind the pill.
 *
 * The anchor moves in exactly three cases:
 *   · the lane changes (a fresh list is a fresh reference — nothing is held);
 *   · the reader is AT THE TOP when the data changes (they would see the
 *     head anyway, so the new posts merge in place with no pill);
 *   · they tap the pill (`merge`), which scrolls to the top and lets go.
 *
 * All three are derived during render from the previous props — React's
 * "remember the last value" pattern — rather than in effects; the only
 * effect here listens to the window's scroll to know whether the reader is
 * at the top, which is an event.
 */
const TOP_PX = 40;

export function useNewPosts<T extends FeedLike>({
  items,
  laneKey,
  meId,
}: {
  /** Everything the feed has fetched, server order, newest first. */
  items: T[];
  /** Changes when the lane or topic does; the hold resets with it. */
  laneKey: string;
  meId: string | null;
}) {
  const reduced = useReducedMotion();
  const [atTop, setAtTop] = useState(true);
  useEffect(() => {
    const read = () => setAtTop(window.scrollY <= TOP_PX);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);

  const [anchorId, setAnchorId] = useState<string | null>(null);
  // Every item id this lane has put on the reader's screen. It is what tells
  // a genuinely new card from one the ranked lane merely moved up — see
  // `splitHeld`. State, not a ref: it is read during render to make the
  // split, and a ref may not be. Reset with the lane.
  const [seen, setSeen] = useState(() => new Set<string>());
  const [lastLane, setLastLane] = useState(laneKey);
  const [lastHead, setLastHead] = useState<string | null>(null);

  // Lane changed: nothing is held against a list that no longer exists.
  if (laneKey !== lastLane) {
    setLastLane(laneKey);
    setAnchorId(null);
    setLastHead(null);
    setSeen(new Set());
  }

  const head = anchorFor(items);
  // The head changed (a refetch, a publish, the first page landing). At the
  // top, or with no anchor yet, the reader takes the fresh head as their own.
  if (head !== lastHead) {
    setLastHead(head);
    if (anchorId === null || atTop) setAnchorId(head);
  }
  // Scrolled back to the top with nothing held is the same as being there.
  if (atTop && anchorId !== null && anchorId !== head && head !== null) {
    const { held } = splitHeld(items, anchorId, meId, seen);
    if (held.length === 0) setAnchorId(head);
  }

  const { shown, held } = splitHeld(items, anchorId, meId, seen);
  // What is on screen now has been seen — recorded the same way the anchor
  // is, as derived state during render ("remember the last value"), AFTER
  // the split, so this render's decision was made against what was seen
  // before it. Guarded on a genuinely new id, so it settles in one pass.
  const unseen = shown.filter((item) => !seen.has(item.id));
  if (unseen.length > 0) {
    const next = new Set(seen);
    for (const item of unseen) next.add(item.id);
    setSeen(next);
  }
  const count = countNew(held, shown);
  const authors = newAuthors(held);

  /** Tap: to the top, then let the held posts in at the head. */
  const merge = () => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    setAnchorId(head);
  };

  return {
    shown,
    held,
    count,
    authors,
    merge,
    /** The pill floats only while the reader is scrolled away from the top. */
    pinned: !atTop && count > 0,
  };
}
