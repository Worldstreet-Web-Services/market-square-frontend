"use client";

import { useRef } from "react";
import { GistRoomCard } from "@/components/layout/gist-room-card";
import { useStreamList } from "@/features/streams";
import { SectionHeading } from "@/components/layout/section-heading";
import { sq } from "@/lib/square-path";

/**
 * THE ROOMS OPEN RIGHT NOW — node 1305:149177, the second section of the
 * 2026-09-12 Home. (It was 647:16288, which drew pager dots and its own 85/78
 * margins; both are gone — the dots belong to the banner in this design, and
 * the column spaces its sections 63 apart.)
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * A 573 x 32 heading row, then 16, then the rail:
 *   · "Top GistRooms" at Manrope Bold 24 / 28.61 — the file draws "Suggested
 *     GistRooms"; ogazboiz renamed it on 2026-09-12, because these are the
 *     rooms actually live rather than a suggestion — with "GistRooms" in the
 *     90deg #C196FD -> #7E3BEB character fill;
 *   · a "View more" pill at the row's right: 94 x 32, 4% white, radius full,
 *     10/4/3/4 of padding on a 14 gap, its label Manrope SemiBold 10/24 at
 *     0.15 tracking beside the file's own 16px arrow. Its stroke is present but
 *     INVISIBLE in the file, so no border is drawn.
 *   · the rail clips, and the cards sit 17 apart.
 *
 * Both the heading and the pill come from `SectionHeading`, which is the one
 * object Home repeats four times.
 *
 * ─── WHY THIS IS NEAR THE TOP OF HOME ────────────────────────────────────────
 * A room happening now beats a subject being discussed, and both beat a post
 * from this morning. It renders NOTHING when no room is open, so a quiet
 * evening costs no space rather than showing an empty shelf.
 *
 * ─── ONE CARD, TWO SURFACES ──────────────────────────────────────────────────
 * The card is `GistRoomCard` unchanged — the same component the group thread
 * draws. The file's instance is 259.06 x 91.97 against its own 0.7664 hairline,
 * which is exactly the 338 x 120 card at radius 22 this app already ships, so
 * nothing about the card changed; a second copy is how one of them ends up with
 * the wrong topic chips.
 *
 * `conversationId` is what the card reads its face-cluster from, and a room on
 * Home is not being read inside any group — so it is given the room's OWN house
 * group when it has one, and nothing when it does not. The stack is absent
 * rather than filled with strangers.
 */
export function LiveGistRooms() {
  // Busiest first — "Top" means the rooms with the most people in them right
  // now, ranked by the service (`sort=listeners`). A deployment without that
  // order falls back to the service's default, which is creation order.
  const rooms = useStreamList("live", [], "house", undefined, "listeners");
  const railRef = useRef<HTMLDivElement | null>(null);

  const items = (rooms.data?.items ?? []).slice(0, 12);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="top-gist-rooms" className="mb-[64px]">
      <div className="mb-4">
        <SectionHeading
          id="top-gist-rooms"
          lead="Top"
          accent="GistRooms"
          action={{ label: "View more", href: sq("/gist-rooms") }}
        />
      </div>

      {/* 1295:147962 — the rail, cards 17 apart, clipped as the frame is. */}
      <div
        ref={railRef}
        className="flex gap-[17px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
    </section>
  );
}
