/**
 * WHOSE FACES GO IN A LIVE ROOM'S STACK.
 *
 * Extracted so the rule can be TESTED rather than inspected. It was wrong in a
 * way no type could catch: the card read `attendees`, which is the ENDED-room
 * field — its schema note says "Absent while a room is LIVE" — so a live room
 * with somebody in it drew an empty stack, and every check passed, because an
 * absent array parses to `[]` and `[]` renders as nothing.
 *
 * The order is the only interesting thing here:
 *
 *   1. `participants` — "a sample of up to three people currently connected,
 *      host first" (gist rooms only). This is the real answer to "who is in
 *      the room". It is present-but-empty on the list route today, which is a
 *      backend gap; the client is written for the day it fills.
 *   2. `owner` — the host. Hydrated on every stream surface, and the one
 *      person certainly in the room. It is what makes a room show a face at
 *      all while (1) is empty.
 *
 * Deduped: a host is normally in their own sample, and a face drawn twice
 * reads as a bug. Capped at three, which is what the card draws.
 *
 * NOT PADDED with house members, followers, or anyone else. A face here says
 * "this person is in the room". Anybody else would make the card state
 * something false on every quiet room, quietly, for ever — so one honest face
 * beats three that include two people who are not there.
 */
export interface FaceProfile {
  id: string;
}

export interface RoomFaceSubject {
  participants?: readonly FaceProfile[];
  owner?: FaceProfile | null;
  /**
   * Accepted ONLY so a caller cannot pass it by mistake and have it silently
   * ignored — it is never read. See the note above: on a live room it is
   * always absent, so reading it is the bug this module exists to prevent.
   */
  attendees?: readonly FaceProfile[];
}

/** How many plates the card draws — `Frame 2147230803` has three. */
export const ROOM_FACE_LIMIT = 3;

export function liveRoomFaces<T extends FaceProfile>(stream: {
  participants?: readonly T[];
  owner?: T | null;
}): T[] {
  const seen = new Set<string>();
  return [...(stream.participants ?? []), ...(stream.owner ? [stream.owner] : [])]
    .filter((profile) => (seen.has(profile.id) ? false : (seen.add(profile.id), true)))
    .slice(0, ROOM_FACE_LIMIT);
}
