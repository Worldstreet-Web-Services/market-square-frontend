/**
 * WHAT THE OS MEDIA CONTROLS SAY ABOUT THE ROOM.
 *
 * The lock screen, Chrome's media hub, a car's Bluetooth display and a watch
 * all read `navigator.mediaSession.metadata` — surfaces anyone nearby can
 * read. A PRIVATE room (its own `audience`, or a room inside a private house)
 * is therefore named neutrally: never its topic, never its host.
 */
export interface MediaSessionRoom {
  title: string;
  audience?: "public" | "private";
  owner?: { displayName: string } | null;
  house?: { visibility: "public" | "private" } | null;
}

export interface MediaSessionText {
  title: string;
  artist: string;
}

export const PRIVATE_ROOM_METADATA: MediaSessionText = { title: "Gist room", artist: "Market Square" };

export function mediaSessionMetadata(room: MediaSessionRoom): MediaSessionText {
  if (room.audience === "private" || room.house?.visibility === "private") return { ...PRIVATE_ROOM_METADATA };
  return { title: room.title.trim() || "Gist room", artist: room.owner?.displayName ?? "Gist room" };
}
