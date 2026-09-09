"use client";

import { FriendsDeck } from "@/components/layout/friends-deck";
import { StoriesRow } from "@/features/feed";
import { useAuth } from "@/hooks/use-auth";

/**
 * THE PALS SURFACE — node 844:18511, the deck on a page of its own.
 *
 * The dock's second destination points here rather than at Explore, because
 * the act its glyph promises is deciding about ONE PERSON AT A TIME — the fan,
 * its pass and its wink — and Explore is a directory you scan.
 *
 * The node opens on the STORIES strip (844:18441, the same 100 × 96 cards
 * Home leads with), then the heading row 47 below it — back disc, the 41.3
 * title, the Location pill — and the deck 89 under that, at the column's full
 * width with the two step discs on its edges. So the page is `StoriesRow`
 * from the feed slice over `FriendsDeck` with its `/pals` heading, stacked
 * from the top at the node's own gaps rather than centred in the viewport.
 *
 * It is the SAME `FriendsDeck` the home timeline renders, not a second copy
 * and not a second card: one component means the wink cooldown, the
 * already-following guard and the swipe-to-browse cannot be fixed on one
 * surface and left broken on the other; `deckLayout` scales the node's 917
 * span to whatever this column is.
 */
export function PalsScreen() {
  // The strip is who you follow, so it exists only for someone signed in —
  // the same gate Home puts on it.
  const { authenticated } = useAuth();
  return (
    <div className="flex min-h-[calc(100dvh-var(--ws-crumb-h)-var(--ws-topbar-h)-var(--ws-nav-h))] flex-col gap-6 px-4 py-6 md:gap-[47px] lg:px-6">
      {authenticated && <StoriesRow />}
      <FriendsDeck heading="pals" />
    </div>
  );
}
