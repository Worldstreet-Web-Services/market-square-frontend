"use client";

import { HousesStreet } from "@/features/houses";
import { GistRoomCard } from "@/components/layout/gist-room-card";
import { UpcomingRoomCard } from "@/components/layout/upcoming-room-card";
import { HomeTopRow } from "@/components/layout/home-top-row";
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
 *  · THE ROOM CARD is `GistRoomCard` with its hover state (415:12704), placed
 *    at 1317:158083's own 0.8594 of the 338 design through `zoom`: every
 *    length inside the card, type included, is the file's at that scale
 *    (12 → 10.31, 16 → 13.75), which is what the instance measures;
 *  · THE UPCOMING CARD is `UpcomingRoomCard`, which scales itself from its
 *    cell.
 */
const ROOM_CARD_SCALE = 290.47 / 338;

export function GistRoomsScreen() {
  return (
    <HousesStreet
      headSlot={<HomeTopRow />}
      headingSlot={(section) =>
        section === "live" ? (
          <SectionHeading id="live-gistrooms" lead="Live" accent="GistRooms" />
        ) : (
          <SectionHeading id="coming-soon-page" lead="Coming Soon" />
        )
      }
      roomCardSlot={(stream) => (
        <div style={{ zoom: ROOM_CARD_SCALE }}>
          <GistRoomCard
            preview
            streamId={stream.id}
            conversationId={stream.houseConversationId ?? ""}
          />
        </div>
      )}
      upcomingCardSlot={(stream) => <UpcomingRoomCard stream={stream} />}
    />
  );
}
