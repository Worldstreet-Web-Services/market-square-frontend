"use client";

import { UpcomingRoomCard } from "@/components/layout/upcoming-room-card";
import { useStreamList } from "@/features/streams";
import { SectionHeading } from "@/components/layout/section-heading";

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
      <div className="mb-4 pl-[5px]">
        {/* 1305:149167 sets this heading ALL WHITE — no gradient half. */}
        <SectionHeading id="coming-soon-rooms" lead="Coming Soon" action={{ label: "View more", href: "/gist-rooms" }} />
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
