/**
 * WHOSE FACES GO IN A LIVE ROOM'S STACK.
 *
 * Extracted so the rule can be TESTED rather than inspected. It was wrong in a
 * way no type could catch: the card read `attendees`, which is the ENDED-room
 * field — its schema note says "Absent while a room is LIVE" — so a live room
 * with somebody in it drew an empty stack, and every check passed, because an
 * absent array parses to `[]` and `[]` renders as nothing.
 *
 * THE ORDER IS THE WHOLE RULE, and it is the one production already ships —
 * `GistRoomCard` on `main` has drawn faces this way for months. It is lifted
 * here verbatim rather than reinvented, so the two cards cannot drift:
 *
 *   1. `participants` — "a sample of up to three people currently connected,
 *      host first" (gist rooms only). The real answer to "who is in the room".
 *   2. `owner` — the host. Hydrated on every stream surface, and the one
 *      person certainly in the room. It is what makes a room opened WITHOUT a
 *      house show a face at all.
 *   3. `roster` — members of the room's own house group, the people the invite
 *      is addressed to. Last, and only to fill places (1) and (2) left empty.
 *
 * Deduped: a host is normally in their own sample AND their own house, and a
 * face drawn twice reads as a bug. Capped at three, which is what the card
 * draws.
 *
 * ─── WHERE `participants` COMES FROM, WHICH IS THE POINT ────────────────────
 * `GET /streams/:id` carries it; the LIST route does not. So a card that only
 * ever reads its list row can name nobody but the owner, however many people
 * are actually in the room. That is not a backend gap to wait on — the detail
 * read is right there, the card polls it anyway to catch live -> ended, and
 * production has been doing exactly this all along. The faces cost no extra
 * request.
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
  participants?: readonly T[] | null;
  owner?: T | null;
  roster?: readonly T[] | null;
}): T[] {
  const seen = new Set<string>();
  return [
    ...(stream.participants ?? []),
    ...(stream.owner ? [stream.owner] : []),
    ...(stream.roster ?? []),
  ]
    .filter((profile) => (seen.has(profile.id) ? false : (seen.add(profile.id), true)))
    .slice(0, ROOM_FACE_LIMIT);
}
