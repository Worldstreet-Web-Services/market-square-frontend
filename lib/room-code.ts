/**
 * THE SPOKEN ROOM CODE — nine characters a person can read down a phone.
 *
 * The service mints it, stores it raw (lower case, no separators) and matches
 * it leniently: any case, any spacing, with or without dashes. Two rules follow
 * from that, and both matter:
 *
 *   · WHAT THE PERSON TYPED IS WHAT WE SEND. Nothing here rewrites input on its
 *     way to the server. If the client normalised, the client and the service
 *     would each hold an opinion about what a code IS, and the day those two
 *     opinions drift is the day a valid code stops resolving for no visible
 *     reason. `looksLikeRoomCode` decides WHERE to send the input; it never
 *     changes it.
 *   · GROUPING IS FOR THE EYE ONLY. `bcd-fghj-km` is easier to read back than
 *     `bcdfghjkm`, so it is how a code is displayed — and never how one is sent.
 *
 * The alphabet has no vowels (a code can never spell a word) and none of
 * 0/O/1/l/I — the glyphs people mishear, where one wrong character would
 * resolve to the WRONG room rather than simply failing.
 */

/** The service's own alphabet: 27 characters, 9 places. */
export const ROOM_CODE_ALPHABET = "23456789bcdfghjkmnpqrstvwxz";
export const ROOM_CODE_LENGTH = 9;

/**
 * Would this input reach a room rather than a search?
 *
 * Used ONLY to choose a destination for what somebody typed into one field
 * that serves both. A false answer is not a rejection — it just means the text
 * goes to search, which is the right home for a name.
 */
export function looksLikeRoomCode(input: string): boolean {
  const bare = input.trim().toLowerCase().replace(/[\s-]/g, "");
  if (bare.length !== ROOM_CODE_LENGTH) return false;
  return [...bare].every((character) => ROOM_CODE_ALPHABET.includes(character));
}

/** `bcdfghjkm` -> `bcd-fghj-km`. Display only; never sent back. */
export function groupRoomCode(code: string): string {
  return code.length === ROOM_CODE_LENGTH
    ? `${code.slice(0, 3)}-${code.slice(3, 7)}-${code.slice(7)}`
    : code;
}

/**
 * WHO MAY SEE A ROOM'S CODE.
 *
 * The host always: it is theirs to read out. In a PUBLIC room, everyone in it
 * too — anyone can already walk in, the listener link in the same sheet is
 * shown to all of them, and a code is just that link in a form a person can
 * say down a phone ("they cant see it in the gist room if it is public").
 *
 * A PRIVATE room keeps it with the host. There the code is how somebody gets
 * handed a way in, and handing out a way into somebody else's private room is
 * not a listener's call.
 *
 * No code, nothing to show: a broadcast is never given one, and neither is a
 * room made before codes shipped.
 */
export function roomCodeVisible(
  /** Anything but "public" — "unknown" included — keeps the code with the host. */
  room: { roomCode: string | null; audience: "public" | "private" | "unknown" },
  isHost: boolean
): boolean {
  if (!room.roomCode) return false;
  return isHost || room.audience === "public";
}
