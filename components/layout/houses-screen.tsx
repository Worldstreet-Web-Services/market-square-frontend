"use client";

import { useState } from "react";

import { Spinner } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useDiscoverHousesPages } from "@/features/messages/lib/discover-houses";
import { useJoinGroup } from "@/features/messages";
import { HomeTopRow } from "@/components/layout/home-top-row";
import { HomeSearch } from "@/components/layout/home-search";
import { HousePreviewSheet, type HousePreview } from "@/components/layout/house-preview-sheet";
import { HouseDirectoryCard } from "@/components/layout/house-directory-card";
import { SectionHeading } from "@/components/layout/section-heading";

/**
 * THE HOUSES DIRECTORY — node 1368:2270 (SQUARE 2.0, file 4tFF5q0CzOSrADkpCOAE03),
 * where Home's Popular Houses "View more" lands.
 *
 * The same 951-wide artboard as the rooms page, on the chrome's `#121214`
 * with the rail's hairline at its right — the shell's FULL frame — inset 22
 * left, 21 right, 22 top:
 *
 *   · the search row (1368:2271): Home's `HomeTopRow` with the FILTER pill
 *     at its right instead of the account pill (see the row);
 *   · 36 below it, the heading (1368:2283) — the file draws "Live GistRooms"
 *     here, a paste from the rooms page; ogazboiz named it "Explore
 *     communities" (2026-09-12), in the same two-tone: "Explore" white,
 *     "communities" on the 90deg #C196FD → #7E3BEB fill;
 *   · 16 below, the grid: three cards across at 290 x 86 (1373:3367), 20
 *     apart, rows 16 apart. The file draws six rows of the same six houses;
 *     this pages through the whole directory on the shared sentinel.
 *
 * ─── THE CARD, 1373:3367 ─────────────────────────────────────────────────────
 * 290 x 86 at radius 16.86, `#101012` at 62% behind a 10.73 blur (CSS takes
 * half), ringed inside at 0.77 `white/18`; the picture 49.89 x 54.21 at
 * radius 12.32 on a white plate at (16, 16); a 127.52-wide text column at
 * (75.75, 16.25), gap 4.93 / inner 2.46 — the name, then three 12.32 faces
 * overlapping by 4.93 (each `#DCDAD5` under a 0.62 white ring with
 * `0 2.46 9.24 rgba(147,147,147,.25)`) and the count 2.46 away, then the
 * description on two lines — and the Join House pill 64 x 24 at (210, 31),
 * radius 61.6, padding 4.93/9.86, on the 90deg `#9F65FD → #5B05E6` ramp over
 * `#7E3BEB`, its label Geist SemiBold 8/10.4.
 *
 * ONE JUDGEMENT, STATED: the file sets the name and description at 7.39px
 * and the count at 4.93px — the 427-wide house card pasted at 0.616 into a
 * box that is not 0.616 of it. 7.39px cannot be read; the room card's rule
 * applies (boxes stay the file's, type at the smallest legible size): the
 * name at 10/12, the description at 10/12.32 (two lines still fit the 25 the
 * file gives them), the count at 8/10.4. The pill keeps its 8/10.4 label
 * because its 64 x 24 box cannot hold a larger one.
 *
 * The data is `GET /conversations/discover`, exactly as Popular Houses reads
 * it: ranked by member count, the reader's own houses excluded, nothing
 * re-sorted. `memberCount` null prints nothing, never "0 members".
 *
 * ─── THE PHONE, 1381:37677 (SQUARE 2.0 Copy, xN01VyIcKwHXIMuWD6Lgbl) ───────
 * One column: 342-wide cards, each FILLING the row ("the card suppose to
 * full the row", ogazboiz 2026-09-12), 16 apart, 106 tall — the same
 * surface (radius 16.86, `#101012`/62%, 0.77 `white/18`, the 10.73 blur) and
 * the same picture at (16, 16). The text column starts at 76 and is 172 wide
 * in the node, i.e. it ends 14 short of the pill: here it is anchored to
 * BOTH edges (76 from the left, 94 = 16 + 64 + 14 from the right) so it
 * still ends 14 short of the pill on any phone. Type is the node's own,
 * not the desktop card's: the name Geist SemiBold 14/18.2, the description
 * Medium 12/15.6 on two lines, 8 between the name block and the
 * description and 4 inside the block; the count is drawn at 4.93px, which
 * gets the same legibility rule as the desktop card (8/10.4). The pill is
 * the same 64 x 24 at 16 from the right, 40 from the top.
 *
 * These are `max-lg:` overrides on the desktop classes rather than a
 * mobile-first base, because the desktop strings are pinned verbatim by
 * `lib/shell-invariants.test.ts` — and `lg`, not `md`, because between md
 * and lg the FULL column is 600 wide, where a 290 cell leaves two thirds of
 * the row empty; the three-across row only exists at the 971 frame. The
 * node is the list alone, so the search row and the heading above it are
 * unchanged, and the page keeps the phone's 16 gutter the other columns use
 * (the node has no page frame to say otherwise).
 */
export function HousesScreen() {
  const houses = useDiscoverHousesPages();
  const join = useJoinGroup();
  const items = houses.data?.pages.flatMap((page) => page.items) ?? [];
  const [query, setQuery] = useState("");
  // The house the reader is previewing before they join — node 1285:36375.
  const [preview, setPreview] = useState<HousePreview | null>(null);
  const searching = query.trim().length > 0;
  const sentinel = useInfiniteScroll(
    () => void houses.fetchNextPage(),
    Boolean(houses.hasNextPage) && !houses.isFetchingNextPage
  );

  // The column answers its own query — see the note in pals-screen.
  if (searching) {
    return (
      <div className="w-full pl-[22px] pr-[21px] pt-[22px] max-lg:px-4">
        <HomeTopRow trailing="filter" value={query} onChange={setQuery} />
        <div className="mt-6">
          <HomeSearch query={query} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pl-[22px] pr-[21px] pt-[22px] max-lg:px-4">
      <HomeTopRow trailing="filter" value={query} onChange={setQuery} />

      <section aria-labelledby="explore-communities" className="mt-9">
        <SectionHeading id="explore-communities" lead="Explore" accent="communities" />

        {houses.isPending ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6 text-grey-600" />
          </div>
        ) : houses.isError && !houses.unavailable ? (
          <div className="px-4 py-8">
            <ErrorState
              error={houses.error}
              fallback="Couldn't load the houses."
              onRetry={() => houses.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          /* The file draws no empty picture; a directory with nothing in it
             says so. `unavailable` (the route not deployed) reads the same
             to a reader: nothing to explore here yet. */
          <div className="mt-4">
            <EmptyPanel
              title="No houses to explore yet"
              body="A house is a community you can join. When somebody opens one to the public, it shows up here."
            />
          </div>
        ) : (
          <>
            {/* 1373:3499… — three fixed cells across, spread to the frame
                (the file's 910 does not fit its own 908 row either), rows 16
                apart; below lg the phone's ONE column (1381:37677), each
                card filling the row. */}
            <div
              role="list"
              aria-label="Houses to join"
              className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] justify-start gap-x-5 gap-y-4 max-lg:grid-cols-1 max-lg:justify-stretch"
            >
              {items.map((house) => (
                <HouseDirectoryCard
                  key={house.id}
                  house={house}
                  onOpen={() => setPreview(house)}
                  onJoin={() => join.mutate(house.id)}
                  joining={join.isPending}
                />
              ))}
            </div>
            <div ref={sentinel} aria-hidden className="h-px" />
            {houses.isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <Spinner className="h-5 w-5 text-grey-600" />
              </div>
            )}
          </>
        )}
      </section>
      {preview && <HousePreviewSheet house={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
