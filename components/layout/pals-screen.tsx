"use client";

import { FriendsDeck } from "@/components/layout/friends-deck";

/**
 * THE PALS SURFACE — node 844:18511, the deck on a page of its own.
 *
 * The dock's second destination points here rather than at Explore, because
 * the act its glyph promises is deciding about ONE PERSON AT A TIME — the fan,
 * its pass and its wink — and Explore is a directory you scan.
 *
 * It is the SAME `FriendsDeck` the home timeline renders, not a second copy
 * and not a second card: one component means the wink cooldown, the
 * already-following guard and the swipe-to-browse cannot be fixed on one
 * surface and left broken on the other. The node draws the deck at the
 * column's full width — the two step discs on its edges, the front card
 * 476.55 of a 917 span in from the left — and `deckLayout` scales that span to
 * whatever this column is, so the page differs from Home only in having
 * nothing else on it and being centred in the viewport's height.
 */
export function PalsScreen() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--ws-crumb-h)-var(--ws-topbar-h)-var(--ws-nav-h))] flex-col justify-center px-4 py-6 lg:px-6">
      <FriendsDeck />
    </div>
  );
}
