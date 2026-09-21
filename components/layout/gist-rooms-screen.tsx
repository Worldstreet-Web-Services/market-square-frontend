"use client";

import { HousesStreet } from "@/features/houses";
import { GistRoomCard } from "@/components/layout/gist-room-card";
import { ComingSoonCard } from "@/components/layout/coming-soon-card";
import { useState } from "react";
import { HomeTopRow } from "@/components/layout/home-top-row";
import { HomeSearch } from "@/components/layout/home-search";
import { SectionHeading } from "@/components/layout/section-heading";

/**
 * The gist rooms page, composed — node 1317:158073 (see `HousesStreet` for
 * the page's numbers).
 *
 * The street belongs to the houses slice; four things on it do not, so all
 * four arrive as slots — the same route-slot pattern `home-screen` and
 * `house-room-screen` use:
 *
 *  · THE SEARCH ROW is Home's `HomeTopRow` (1317:158074 is 1295:142736 again,
 *    908 wide with the pill open);
 *  · THE HEADINGS are `SectionHeading`, the one object Home repeats — here
 *    without its "View more", because this is the page that pill opens;
 *  · THE ROOM CARD is `GistRoomCard` (node 1769:3670) with its hover state
 *    (415:12704), rendered FLUID at its natural size — the old `zoom` that
 *    scaled it into a 290 cell broke the mic badge's SVG gradient on desktop,
 *    so the card fills its grid cell instead;
 *  · THE UPCOMING CARD is `ComingSoonCard` — the wide horizontal card
 *    (node 1542:3294), the same one Home's Coming Soon rail draws, so the two
 *    surfaces cannot drift. It fills its grid cell, so the grid is at most two
 *    across (see HousesStreet).
 */
export function GistRoomsScreen() {
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;
  const row = <HomeTopRow value={query} onChange={setQuery} />;

  // The column answers its own query — see the note in pals-screen. Returned
  // before HousesStreet rather than threaded through it: the street draws
  // rooms, and a search is not a shorter list of rooms.
  if (searching) {
    return (
      <div className="w-full pl-[22px] pr-[21px] pt-[22px]">
        {row}
        <div className="mt-6">
          <HomeSearch query={query} />
        </div>
      </div>
    );
  }

  return (
    <HousesStreet
      headSlot={row}
      headingSlot={(section) =>
        section === "live" ? (
          <SectionHeading id="live-gistrooms" lead="Live" accent="GistRooms" />
        ) : (
          <SectionHeading id="coming-soon-page" lead="Coming Soon" />
        )
      }
      roomCardSlot={(stream) => (
        <GistRoomCard
          fluid
          preview
          streamId={stream.id}
          conversationId={stream.houseConversationId ?? ""}
        />
      )}
      upcomingCardSlot={(stream) => <ComingSoonCard stream={stream} />}
    />
  );
}
