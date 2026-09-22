"use client";

// Client boundary for a house. A server route cannot pass a render prop into a
// client component, so the cross-slice composition — the houses room plus the
// profile slice's follow control and safety rows — happens here, in the layout
// layer, which is the one place below app/ allowed to compose features.
//
// The slots take a USERNAME rather than a Profile: a room learns who somebody
// is from the identity on their room token, and never holds the whole object.

import { HouseRoom } from "@/features/houses";
import { PersonFollow, PersonSafetyRows } from "@/features/profile";

export function HouseRoomScreen({ houseId }: { houseId: string }) {
  return (
    <HouseRoom
      houseId={houseId}
      followSlot={(username) => <PersonFollow username={username} />}
      safetySlot={(username, mute) => <PersonSafetyRows username={username} mute={mute} />}
    />
  );
}
