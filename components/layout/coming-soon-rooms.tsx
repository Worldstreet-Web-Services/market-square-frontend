"use client";

import Link from "next/link";
import { UpcomingRoomCard } from "@/components/layout/upcoming-room-card";
import { useStreamList } from "@/features/streams";

/**
 * GIST ROOMS THAT HAVE NOT OPENED YET — Home's "Coming soon".
 *
 * Sits directly under "Make some friends", which is the point ogazboiz made:
 * once somebody schedules a room it should be visible from Home, not only on
 * /gist-rooms. The rooms open RIGHT NOW still lead the column (LiveGistRooms,
 * above the deck) — a room you can walk into beats one you have to wait for, so
 * this never competes with it for the top of the page.
 *
 * It is built to match the block above it rather than invented: the same
 * two-tone heading and "View more" pill, the same sideways rail, the same rule
 * that an empty list renders NOTHING AT ALL — no heading, no empty shelf, no
 * spacer. A square where nobody has scheduled anything costs no height.
 *
 * The card is `UpcomingRoomCard` unchanged, the 1295:140164 card the gist rooms
 * page uses, at its own 479 width. One card, two surfaces — a second copy is
 * how the two drift apart.
 */
export function ComingSoonRooms() {
  // The same list /gist-rooms reads for its Upcoming rail.
  const rooms = useStreamList("scheduled", [], "house");
  const items = (rooms.data?.items ?? []).slice(0, 12);

  // Nothing scheduled is not an empty state — it is no section.
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="coming-soon-rooms" className="mb-[78px]">
      <div className="mb-[19px] flex items-start justify-between gap-4 pl-[5px]">
        <h2
          id="coming-soon-rooms"
          className="inline-block bg-[linear-gradient(90deg,#C196FD_0%,#7E3BEB_100%)] bg-clip-text text-[32px] font-medium leading-[28.615px] text-transparent"
        >
          <span className="text-white">Coming </span>soon
        </h2>
        <Link
          href="/gist-rooms"
          className="ws-press mt-[5px] flex h-8 shrink-0 items-center gap-2.5 rounded-full bg-white/[0.04] px-2.5 text-[16px] font-semibold leading-6 tracking-[0.15px] text-white transition-colors hover:bg-white/[0.08]"
        >
          View more
          <IconViewMoreArrow className="h-4 w-4 text-[#9F5AFF]" />
        </Link>
      </div>

      <div className="flex items-center gap-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((room) => (
          <div key={room.id} className="w-[479px] shrink-0">
            <UpcomingRoomCard stream={room} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** The same exported arrow the block above uses — node 1069:11820. */
function IconViewMoreArrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.00003 12C6.00003 12 9.99999 9.05404 10 7.99997C10 6.94589 6 4 6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
