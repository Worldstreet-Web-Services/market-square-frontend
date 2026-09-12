"use client";

import { useRef, useState } from "react";
import { GistRoomCard } from "@/components/layout/gist-room-card";
import { useStreamList } from "@/features/streams";
import { DeckDots } from "@/components/ui/deck-dots";
import { SectionHeading } from "@/components/layout/section-heading";

/**
 * THE ROOMS OPEN RIGHT NOW — the first block of Home's content column, node
 * 647:16288 in the live file (updated 2026-09-10); first built from 225:3822.
 *
 * ─── THE LIVE FILE'S NUMBERS ─────────────────────────────────────────────────
 * A heading row (1069:11814 + 1069:11818) over the dots (647:16289) over the
 * card row (647:17211):
 *   · "Top GistRooms" (the file draws "Suggested GistRooms"; ogazboiz renamed
 *     it on 2026-09-12, because the rooms here are the ones actually live
 *     rather than a suggestion), Medium 32 / 28.615 — the first word white and
 *     "GistRooms" in the file's 90deg #C196FD -> #7E3BEB character fill —
 *     beside a "View more" pill: 32 tall, 4% white, 10 either side and 10
 *     between the label (Semibold 16/24, 0.15 tracking) and the exported arrow.
 *     Geist, not the file's Roboto. The pill has no prototype link in the file;
 *     it opens the gist rooms page, which is what "more" of these is.
 *   · the pill sits 5 lower than the heading's top, and the dots 19 under the
 *     row; heading and dots are both inset 5 from the cards' edge.
 *   · the dots 8.67 above the cards; the cards 17 apart.
 *   · the section sits 85 under the banner and 78 above "Make some friends".
 *
 * A horizontally scrolling row of the SAME invite card the thread uses
 * (225:3873), with the file's pager dots above it — node 225:3519, read
 * exactly: FIVE segments 4.33 tall at a 13.54 radius on a 2.71 gap, the active
 * one 27.08 wide in `#7E3BEB` and the rest 9.21 wide in `#D9D9D9`.
 *
 * (The file draws the second dot at 10.29 rather than 9.21. That is a rounding
 * artifact of a group that was scaled, not a state — the other three are
 * identical — so every inactive dot is 9.21 here.)
 *
 * ─── WHY THIS IS AT THE TOP OF HOME ──────────────────────────────────────────
 * A room happening now beats a subject being discussed, and both beat a post
 * from this morning. It renders NOTHING when no room is open, so a quiet
 * evening costs no space rather than showing an empty shelf.
 *
 * ─── ONE CARD, TWO SURFACES ──────────────────────────────────────────────────
 * The card is `GistRoomCard` unchanged — the same component the group thread
 * draws (see its own header for the two judgement calls it carries). The file
 * uses the same 338x120 object in both places, so the code does too; a second
 * copy is how one of them ends up with the wrong topic chips.
 *
 * `conversationId` is what the card reads its face-cluster from, and a room on
 * Home is not being read inside any group — so it is given the room's OWN house
 * group when it has one, and nothing when it does not. The stack is absent
 * rather than filled with strangers.
 *
 * ─── THE DOTS ARE PAGES, NOT CARDS ───────────────────────────────────────────
 * The file draws four. A square with forty open rooms would grow forty dots and
 * lose the shape entirely, so they are capped and each stands for a SCREENFUL:
 * the active one is derived from the scroll position rather than from a card
 * index, which is what makes dragging move them at all.
 */
const DOTS = 5;

export function LiveGistRooms() {
  // Busiest first — "Top" means the rooms with the most people in them right
  // now, ranked by the service (`sort=listeners`). A deployment without that
  // order falls back to the service's default, which is creation order.
  const rooms = useStreamList("live", [], "house", undefined, "listeners");
  const railRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);

  const items = (rooms.data?.items ?? []).slice(0, 12);

  // Derived from the scroll offset, so the dots track a drag rather than only
  // a tap. `scrollWidth - clientWidth` is zero when everything fits, which is
  // also when the dots are hidden — guarded so it never divides by it.
  const onScroll = () => {
    const node = railRef.current;
    if (!node) return;
    const room = node.scrollWidth - node.clientWidth;
    setPage(room <= 0 ? 0 : Math.round((node.scrollLeft / room) * (DOTS - 1)));
  };

  if (items.length === 0) return null;

  // Clamped rather than reset in an effect: the dot index is DERIVED from the
  // scroll position, so a list that shrank under the reader just clamps on the
  // next render — a setState in an effect here fired a second render for a
  // value nothing had asked to change.
  const active = Math.min(page, DOTS - 1);

  return (
    <section aria-labelledby="top-gist-rooms" className="mb-[78px] mt-[85px]">
      <div className="mb-[19px] pl-[5px]">
        <SectionHeading
          id="top-gist-rooms"
          lead="Top"
          accent="GistRooms"
          action={{ label: "View more", href: "/gist-rooms" }}
        />
      </div>

      <div className="flex flex-col gap-[8.67px]">
        {items.length > 1 && (
          <DeckDots count={DOTS} active={active} className="justify-start pl-[5px]" />
        )}

        <div
          ref={railRef}
          onScroll={onScroll}
          className="flex gap-[17px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((room) => (
            <div key={room.id} className="shrink-0 snap-start">
              <GistRoomCard
                streamId={room.id}
                conversationId={room.houseConversationId ?? ""}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
