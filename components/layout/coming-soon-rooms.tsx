"use client";

import { ComingSoonCard } from "@/components/layout/coming-soon-card";
import { useStreamList } from "@/features/streams";
import { SectionHeading } from "@/components/layout/section-heading";
import { sq } from "@/lib/square-path";

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
 * ─── THE CARD IS NODE 1542:3294, THE WIDE HORIZONTAL ONE ───────────────────
 * ogazboiz asked to go back to the horizontal card (2026-09-21): a purple
 * accent bar on the left, the room's cover, its title / category / host, a
 * divider, then the date, time, a "Starts in …" pill and Share, right-aligned.
 * That is `ComingSoonCard` — a component of ITS OWN rather than the vertical
 * banner `UpcomingRoomCard` the gist-rooms grid draws, because the two
 * surfaces are two different shapes; the data wiring is shared so they cannot
 * drift on what a room is. The rail runs sideways and is clipped at the
 * column's edge, the cards at the node's own 467 on a 16 gap.
 *
 * The heading is all white ("Coming Soon"); "View more" going to the rooms
 * page is this product's convention, as on the other three headings.
 */
export function ComingSoonRooms() {
  // The same list /gist-rooms reads for its Upcoming rail.
  const rooms = useStreamList("scheduled", [], "house");
  const items = (rooms.data?.items ?? []).slice(0, 12);

  // Nothing scheduled is not an empty state — it is no section.
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="coming-soon-rooms" className="mb-10">
      <div className="mb-4">
        {/* 1305:149167 sets this heading ALL WHITE — no gradient half. */}
        <SectionHeading id="coming-soon-rooms" lead="Coming Soon" action={{ label: "View more", href: sq("/gist-rooms") }} />
      </div>

      {/* The rail, clipped at the column's edge; the horizontal cards at the
          node's own 467 on a 16 gap (see the header). */}
      <div className="flex items-stretch gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((room) => (
          <div key={room.id} className="w-[342px] max-w-[95%] shrink-0">
            <ComingSoonCard stream={room} />
          </div>
        ))}
      </div>
    </section>
  );
}
