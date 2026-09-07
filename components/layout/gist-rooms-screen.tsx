"use client";

import { HousesStreet } from "@/features/houses";
import { GistRoomCard } from "@/components/layout/gist-room-card";

/**
 * The gist rooms page, composed — node 407:17074.
 *
 * The street belongs to the houses slice; the card in each of its cells reads
 * three OTHER slices (streams for the room, discovery for the topic vocabulary,
 * messages for the roster), so it is joined here and handed down as a slot. The
 * same route-slot pattern `home-screen` and `house-room-screen` already use,
 * and the reason `features/houses` does not import it directly.
 */
export function GistRoomsScreen() {
  return (
    <HousesStreet
      roomCardSlot={(stream) => (
        <GistRoomCard
          fluid
          streamId={stream.id}
          conversationId={stream.houseConversationId ?? ""}
        />
      )}
    />
  );
}
