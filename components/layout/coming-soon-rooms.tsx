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
 * ─── NODE 1305:149184, THE 2026-09-12 COLUMN'S OWN DRAWING ─────────────────
 * A 581-wide section: the heading row (32 tall — "Coming Soon" in Manrope Bold
 * 24/28.61, all white, and the "View more" pill at its right edge), 16 below
 * it the rail (1305:148882): a 606-wide horizontal row that runs PAST the
 * section's right edge and is clipped there. Every number inside a card
 * divides by its 0.5519 stroke to the 479 x 147 design of 1295:140164 — the
 * same card, placed at 0.5519 (264.35 x 81.13 on an 11.04 gap) — so the card
 * is `UpcomingRoomCard` unchanged (it scales itself from its width) and only
 * the WIDTH and the GAP are this section's. One card, two surfaces — a second
 * copy is how the two drift apart.
 *
 * THE WIDTH IS POPULAR HOUSES', NOT THE NODE'S. Built at the file's 264.35
 * the cards read as too small next to the rest of the column ("the card
 * height for those coming soon is too small"), so they take the treatment
 * Popular Houses got (1305:149179): the same 356 rail width on the same 15.7
 * gap, and the card scales up with it — 356 x 109.3, every internal length
 * still the file's proportion (ogazboiz, 2026-09-12).
 *
 * The node carries no `interactions`; "View more" going to the rooms page is
 * this product's convention, as on the other three headings.
 */
export function ComingSoonRooms() {
  // The same list /gist-rooms reads for its Upcoming rail.
  const rooms = useStreamList("scheduled", [], "house");
  const items = (rooms.data?.items ?? []).slice(0, 12);

  // Nothing scheduled is not an empty state — it is no section.
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="coming-soon-rooms" className="mb-[64px]">
      <div className="mb-4">
        {/* 1305:149167 sets this heading ALL WHITE — no gradient half. */}
        <SectionHeading id="coming-soon-rooms" lead="Coming Soon" action={{ label: "View more", href: "/gist-rooms" }} />
      </div>

      {/* 1305:148882 — the rail, clipped at the column's edge; the cards at
          Popular Houses' 356 on its 15.7 gap (see the header). */}
      <div className="flex items-center gap-[15.7px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((room) => (
          <div key={room.id} className="w-[356px] shrink-0">
            <UpcomingRoomCard stream={room} />
          </div>
        ))}
      </div>
    </section>
  );
}
