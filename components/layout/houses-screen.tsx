"use client";

import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useDiscoverHousesPages } from "@/features/messages/lib/discover-houses";
import { useJoinGroup } from "@/features/messages";
import { HomeTopRow } from "@/components/layout/home-top-row";
import { HomeSearch } from "@/components/layout/home-search";
import { HousePreviewSheet, type HousePreview } from "@/components/layout/house-preview-sheet";
import { SectionHeading } from "@/components/layout/section-heading";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/square-path";

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
              className="mt-4 grid grid-cols-[repeat(auto-fill,290px)] justify-start gap-x-5 gap-y-4 lg:grid-cols-3 lg:justify-between max-lg:grid-cols-1 max-lg:justify-stretch"
            >
              {items.map((house) => (
                <article
                  key={house.id}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`View ${house.title ?? "house"}`}
                  onClick={() => setPreview(house)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPreview(house);
                    }
                  }}
                  className="ws-press relative h-[86px] w-[290px] cursor-pointer overflow-hidden rounded-[16.86px] bg-[rgba(16,16,18,0.62)] shadow-[inset_0_0_0_0.77px_rgba(255,255,255,0.18)] backdrop-blur-[5.37px] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent max-lg:h-[106px] max-lg:w-full"
                >
                  {/* 1373:3368 / 1381:37629 — the picture on its white plate:
                      a 48.05 SQUARE (image 66, sharp-cornered) inset 1.23 at
                      the sides and 3.08 top and bottom, so the plate shows
                      as a white frame round it. It used to be `Avatar`
                      filling the plate edge to edge, which drew a stranger's
                      seeded illustration for a house with no picture
                      ("it suppose to be that normal square and show the
                      image or the default image", ogazboiz 2026-09-12).

                      NO PICTURE → node 1373:3990, the file's default: the
                      SAME 49.89 x 54.21 plate at 12.32 filled `#D8D8D8` with
                      the gist glyph 32.78 x 24 centred in it, no white
                      frame — the export the room card already uses. Not the
                      node's sample photo: that is one designer's house, and
                      every house without a picture would wear it. */}
                  <span
                    className={cn(
                      "absolute left-4 top-4 h-[54.21px] w-[49.89px] overflow-hidden rounded-[12.32px] bg-white",
                      !house.imageUrl && "flex items-center justify-center bg-[#D8D8D8]"
                    )}
                  >
                    {house.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the house's own host is unknown
                      <img
                        src={house.imageUrl}
                        alt=""
                        className="absolute left-[1.23px] top-[3.08px] h-[48.05px] w-[48.05px] object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- the node's own export
                      <img
                        src={asset("/gist-rooms/card-default-cover.svg")}
                        alt=""
                        aria-hidden
                        className="h-6 w-[32.78px]"
                      />
                    )}
                  </span>

                  {/* 1373:3370 — the text column. */}
                  <div className="absolute left-[75.75px] top-[16.25px] flex w-[127.52px] flex-col gap-[4.93px] max-lg:left-[76px] max-lg:right-[94px] max-lg:top-4 max-lg:w-auto max-lg:gap-2">
                    <div className="flex flex-col gap-[2.46px] max-lg:gap-1">
                      <p className="truncate text-[10px] font-semibold leading-3 text-white max-lg:text-[14px] max-lg:leading-[18.2px]">
                        {house.title ?? "Untitled house"}
                      </p>
                      <div className="flex h-[12.32px] items-center gap-[2.46px]">
                        {house.members.length > 0 && (
                          <span aria-hidden className="flex items-center">
                            {house.members.slice(0, 3).map((member, index) => (
                              <span
                                key={member.id}
                                className="flex h-[12.32px] w-[12.32px] items-center justify-center overflow-hidden rounded-[25%] bg-[#DCDAD5] shadow-[inset_0_0_0_0.62px_#FFFFFF,0_2.46px_9.24px_rgba(147,147,147,0.25)]"
                                style={{ marginLeft: index === 0 ? 0 : -4.93 }}
                              >
                                <Avatar
                                  name={member.displayName || member.username}
                                  seed={member.id}
                                  src={member.avatarUrl}
                                  size={12}
                                  sizeClassName="h-full w-full"
                                  className="rounded-none border-0"
                                />
                              </span>
                            ))}
                          </span>
                        )}
                        {house.memberCount !== null && (
                          <span className="tnum text-[8px] font-medium leading-[10.4px] text-white">
                            {house.memberCount.toLocaleString()}{" "}
                            {house.memberCount === 1 ? "member" : "members"}
                          </span>
                        )}
                      </div>
                    </div>
                    {house.description && (
                      <p className="line-clamp-2 text-[10px] font-normal leading-[12.32px] text-white max-lg:text-[12px] max-lg:font-medium max-lg:leading-[15.6px]">
                        {house.description}
                      </p>
                    )}
                  </div>

                  {/* 1373:3383 — Join House, centred on the right edge. */}
                  <button
                    type="button"
                    disabled={join.isPending}
                    onClick={(event) => {
                      // Quick-join without opening the preview.
                      event.stopPropagation();
                      join.mutate(house.id);
                    }}
                    /* The file stacks `#7E3BEB` under an opaque 90deg `#9F65FD → #5B05E6`
                       ramp, so only the ramp is ever seen — `ws-btn-welcome`, the
                       existing utility for exactly that pair. (A two-layer `background`
                       in an arbitrary class compiles to nothing.) */
                    className="ws-btn-welcome ws-press absolute right-4 top-[31px] flex h-6 w-16 items-center justify-center rounded-[61.6px] text-[8px] font-semibold leading-[10.4px] text-white transition-opacity hover:opacity-90 disabled:opacity-40 max-lg:top-[40px]"
                  >
                    Join House
                  </button>
                </article>
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
