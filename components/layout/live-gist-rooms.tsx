"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { GistRoomCard } from "@/components/layout/gist-room-card";
import { useStreamList } from "@/features/streams";
import { DeckDots } from "@/components/ui/deck-dots";

/**
 * THE ROOMS OPEN RIGHT NOW — the first block of Home's content column, node
 * 647:16288 in the live file (updated 2026-09-10); first built from 225:3822.
 *
 * ─── THE LIVE FILE'S NUMBERS ─────────────────────────────────────────────────
 * A heading row (1069:11814 + 1069:11818) over the dots (647:16289) over the
 * card row (647:17211):
 *   · "Suggested GistRooms", Medium 32 / 28.615 — "Suggested " white and
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
  const rooms = useStreamList("live", [], "house");
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
    <section aria-labelledby="suggested-gist-rooms" className="mb-[78px] mt-[85px]">
      <div className="mb-[19px] flex items-start justify-between gap-4 pl-[5px]">
        <h2
          id="suggested-gist-rooms"
          className="inline-block bg-[linear-gradient(90deg,#C196FD_0%,#7E3BEB_100%)] bg-clip-text text-[32px] font-medium leading-[28.615px] text-transparent"
        >
          <span className="text-white">Suggested </span>GistRooms
        </h2>
        <Link
          href="/gist-rooms"
          className="ws-press mt-[5px] flex h-8 shrink-0 items-center gap-2.5 rounded-full bg-white/[0.04] px-2.5 text-[16px] font-semibold leading-6 tracking-[0.15px] text-white transition-colors hover:bg-white/[0.08]"
        >
          View more
          <IconViewMoreArrow className="h-4 w-4 text-[#9F5AFF]" />
        </Link>
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

/** The "View more" arrow — `arrow-left-01-round` turned 180deg, node 1069:11820, exported from the file. */
function IconViewMoreArrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.00003 12C6.00003 12 9.99999 9.05404 10 7.99997C10 6.94589 6 4 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
