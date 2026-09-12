"use client";

import { FriendsDeck } from "@/components/layout/friends-deck";
import { HomeTopRow } from "@/components/layout/home-top-row";
import { POST_SLOTS } from "@/components/layout/home-screen";
import { FeedPage, StoriesRow } from "@/features/feed";
import { useAuth } from "@/hooks/use-auth";

/**
 * THE PALS SURFACE — node 1328:1885 (in the 1440 page 1328:1882), the deck on
 * a page of its own, with the following lane under it.
 *
 * The dock's second destination points here rather than at Explore, because
 * the act its glyph promises is deciding about ONE PERSON AT A TIME — the fan,
 * its pass and its wink — and Explore is a directory you scan.
 *
 * The node is a 951-wide artboard on the chrome's own `#121214` (the shell's
 * FULL frame, as the gist rooms and houses pages are). Everything it draws is
 * in its left 618 (1331:21792), top to bottom:
 *
 *   · the SEARCH ROW (1331:21793) at (13, 12), 574 x 48 — the same field and
 *     settings pill Home's column opens on (1295:142736), number for number:
 *     `HomeTopRow`, unchanged;
 *   · the STORIES (1331:21802) at (13, 111), 596 x 96 — "Your Story" then the
 *     strip on a 12, the tiles on a 5.45 — the feed slice's `StoriesRow`,
 *     which is who you follow and so exists only for a signed-in reader;
 *   · the Location pill at y=313, the deck at 390 and "Make some friends" at
 *     1016 — `FriendsDeck` in its `/pals` form, whose `PALS_PAGE` offsets are
 *     the node's own in the deck's units, untouched here;
 *   · the FEED (1344:21876) — post cards 573.14 wide on a 47.89 gap from
 *     (25, 1058), every author in the "Following" state: the FOLLOWING lane,
 *     which `FeedPage` draws in its `pals` mode. Nothing else — no banner,
 *     no rooms, no houses, no suggested pals; the page draws none.
 *
 * `FeedPage` owns the column's vertical rhythm (12, 51, 106, 13.39) and the
 * list's width; this file composes the head and the slots the feed slice may
 * not import — the follow, wink and tip controls come from `home-screen`'s
 * one composition, and the deck is the same `FriendsDeck` the home timeline
 * renders, so the wink cooldown, the already-following guard and the swipe
 * cannot be fixed on one surface and left broken on the other.
 *
 * 1331:21318 is the node's own edge: a 33-wide strip at x=589, 4190 tall from
 * y=68, `#121214` fading from opaque at its foot to nothing at its head — the
 * column's right edge over the rail's hairline. The shell draws nothing like
 * it on a FULL route, so it is drawn here, from lg where the column is wide
 * enough to have an x=589, and capped to the page so it never scrolls past
 * it.
 */
export function PalsScreen() {
  // The strip is who you follow, so it exists only for someone signed in —
  // the same gate Home put on it.
  const { authenticated } = useAuth();
  return (
    <div className="relative">
      <FeedPage
        mode="pals"
        {...POST_SLOTS}
        headSlot={
          <>
            {/* 1331:21793 — 574 wide, 2 past the wrapper's 11 (the node's 13). */}
            <div className="md:ml-0.5 md:w-[574px]">
              <HomeTopRow />
            </div>
            {/* 1331:21802 — 596 wide on the same 13, 51 under the row (60 -> 111). */}
            {authenticated && (
              <div className="mt-[51px] md:ml-0.5 md:w-[596px]">
                <StoriesRow />
              </div>
            )}
          </>
        }
        friendsSlot={<FriendsDeck heading="pals" />}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[589px] top-[68px] hidden h-[4190px] max-h-[calc(100%-68px)] w-[33px] bg-[linear-gradient(to_top,#121214_0%,rgba(18,18,20,0)_100%)] lg:block"
      />
    </div>
  );
}
