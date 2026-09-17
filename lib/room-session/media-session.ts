/**
 * WHAT THE OS MEDIA CONTROLS SAY ABOUT THE ROOM.
 *
 * The lock screen, Chrome's media hub, a car's Bluetooth display and a watch
 * all read `navigator.mediaSession.metadata` — surfaces anyone nearby can
 * read. A room is named there ONLY when it is KNOWN to be public: its own
 * audience says public, and it either belongs to no house or its house's
 * doorplate says public. Everything else — a private room, a room in a
 * private house, and every case where the facts are missing — is named
 * neutrally: never its topic, never its host.
 *
 * FAIL CLOSED, because the facts do go missing. The doorplate (`house`) comes
 * only from `GET /streams/:id`; go-live's payload and a stream update carry
 * none, a deleted house is null, and `audience` parses an unknown value as
 * public. Checking for "private" read every one of those as public and put a
 * private house room's topic and host on the lock screen.
 */
export interface MediaSessionRoom {
  title: string;
  /** Anything but "public" — absent included — is treated as private. */
  audience?: string;
  owner?: { displayName: string } | null;
  /** The house group the room belongs to, or null for a room from the street. */
  houseConversationId: string | null;
  house?: { visibility: string } | null;
}

export interface MediaSessionText {
  title: string;
  artist: string;
}

export const PRIVATE_ROOM_METADATA: MediaSessionText = { title: "Gist room", artist: "Market Square" };

export function mediaSessionMetadata(room: MediaSessionRoom): MediaSessionText {
  const knownPublic =
    room.audience === "public" && (room.houseConversationId === null || room.house?.visibility === "public");
  if (!knownPublic) return { ...PRIVATE_ROOM_METADATA };
  return { title: room.title.trim() || "Gist room", artist: room.owner?.displayName ?? "Gist room" };
}
