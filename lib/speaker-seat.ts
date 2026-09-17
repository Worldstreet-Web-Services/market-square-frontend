/**
 * A SEATED SPEAKER WHOSE CONNECTION DROPS.
 *
 * The service holds the seat for a grace window (60 s) so a network blip, a
 * Wi-Fi to 4G switch or a reload does not cost a speaker their place mid
 * conversation. Past it, the seat is released and they come back as audience
 * (ogazboiz, 2026-09-17). Two things follow on screen, and both are pure:
 *
 *   · the speaker, once released, is told WHY they are in the audience —
 *     only for `removedReason: 'disconnected'`, never for a host's Move down,
 *     which the room already shows;
 *   · the host sees a seated speaker who is momentarily absent as
 *     "Reconnecting…", instead of a seat that looks fine while nobody is there.
 */

export const SEAT_RELEASED_NOTICE =
  "You lost connection, so you were moved to the audience. Raise your hand to speak again.";

export function seatReleasedNotice(
  previous: { id: string; status: string } | null,
  row: { id: string; status: string; removedReason?: "host" | "disconnected" | null } | null | undefined
): string | null {
  // The SAME request going from seated to released. /speaker-requests/me keeps
  // answering with the removed row until the reader asks again, so matching
  // the id is what makes this once — and never carries over between rooms.
  if (!previous || previous.status !== "approved" || !row || row.id !== previous.id) return null;
  return row.status === "removed" && row.removedReason === "disconnected" ? SEAT_RELEASED_NOTICE : null;
}

/**
 * Is a seated speaker connected? `connected` holds the bare user id of every
 * participant in the room (`<did>#speaker` already reduced to `<did>`). Null
 * before the room has been read: an unread room says nothing about anybody,
 * so nobody is shown as reconnecting on the first frame.
 */
export function seatPresence(userId: string, connected: ReadonlySet<string> | null): "present" | "reconnecting" {
  if (connected === null) return "present";
  return connected.has(userId) ? "present" : "reconnecting";
}
