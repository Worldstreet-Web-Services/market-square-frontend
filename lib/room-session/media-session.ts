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

function knownPublic(room: MediaSessionRoom): boolean {
  return room.audience === "public" && (room.houseConversationId === null || room.house?.visibility === "public");
}

export function mediaSessionMetadata(room: MediaSessionRoom): MediaSessionText {
  if (!knownPublic(room)) return { ...PRIVATE_ROOM_METADATA };
  return { title: room.title.trim() || "Gist room", artist: room.owner?.displayName ?? "Gist room" };
}

/**
 * THE ROOM'S NAME ON A SURFACE ANYONE AT THE SCREEN CAN READ — the minimised
 * bar and chip that follow the reader onto every page, the hang-up's label,
 * the guard sheets, the rejoin chip. The same rule as the lock screen: the
 * topic only when the room is known to be public, "Gist room" otherwise. The
 * room's own page, which the reader chose to open, keeps the real topic.
 */
export function sharedSurfaceTitle(room: MediaSessionRoom, topic: string): string {
  return knownPublic(room) ? topic : PRIVATE_ROOM_METADATA.title;
}

/**
 * MAY THE OS HANG-UP END THIS READER'S SESSION?
 *
 * Chrome's media hub, Picture-in-Picture and a headset's button all send
 * `hangup` with no confirmation of their own. For a listener that is the
 * mini-player's one-tap Leave. For anybody else it is not: the in-app red
 * button asks a seated speaker before giving up their seat, and sends a host
 * to "Close the gist room?" — a bare leave from the lock screen disconnected
 * the host and left their room live with nobody running it. So only a
 * listener gets the action; a host or speaker closes or leaves in the app.
 */
export function osHangUpAllowed(presence: "host" | "speaker" | "listener" | null): boolean {
  return presence === "listener";
}
