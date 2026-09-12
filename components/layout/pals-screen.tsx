"use client";

import { FriendsDeck } from "@/components/layout/friends-deck";

/**
 * THE PALS SURFACE — node 1328:1885, the deck on a page of its own.
 *
 * The dock's second destination points here rather than at Explore, because
 * the act its glyph promises is deciding about ONE PERSON AT A TIME — the fan,
 * its pass and its wink — and Explore is a directory you scan.
 *
 * The node is a 951-wide artboard on the chrome's own `#121214` (the shell's
 * FULL frame, as the gist rooms and houses pages are), and it draws THREE
 * things, all in its left 607: the Location pill at y=313, flush with the
 * right edge of a 579-wide group that starts 26 in; the deck group
 * (1331:21321) at y=390, 596 wide from 11 in; and "Make some friends"
 * (1344:21868) at y=1016, 26 in. Nothing else — no stories strip, no back
 * disc, no title row over the deck, no subtitle, no search row. The strip and
 * the title row were 844:18511's and left with it.
 *
 * All three are drawn by `FriendsDeck` in its `/pals` form: the pill, the deck
 * and the heading share one scale (`deckLayout`'s `k`) and one measured width,
 * so their offsets stay the file's at every column. Only the 313 above the
 * pill is this wrapper's — it is the node's from `md`, and the column's
 * ordinary 24 below it, where 313 of nothing above a phone's first control
 * would be most of the screen (no phone frame was given).
 *
 * It is the SAME `FriendsDeck` the home timeline renders, not a second copy
 * and not a second card: one component means the wink cooldown, the
 * already-following guard and the swipe cannot be fixed on one surface and
 * left broken on the other.
 */
export function PalsScreen() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--ws-crumb-h)-var(--ws-topbar-h)-var(--ws-nav-h))] flex-col px-4 pb-6 pt-6 md:px-[11px] md:pt-[313px]">
      <FriendsDeck heading="pals" />
    </div>
  );
}
