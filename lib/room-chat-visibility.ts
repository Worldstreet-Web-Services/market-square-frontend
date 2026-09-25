/**
 * WHAT A ROOM'S CHAT MAY BE USED FOR OUTSIDE THE ROOM.
 *
 * One question now, and it is about BROADCASTING: may this room be announced
 * on a public socket topic. The other — whether a room's words may be drawn
 * under its post — is answered on the SERVICE, which writes those words as
 * ordinary comments and gates that write itself. A client that re-decided it
 * would be the second copy of one judgement, and the second copy drifts.
 */

export interface RoomChatSubject {
  visibility?: "public" | "ticketed";
  /**
   * WHO MAY FIND AND ENTER THE ROOM — `public`, or `private` for one gated to
   * its house. Distinct from `visibility`, which is about PAYING, and it is
   * the field the service itself gates on. `unknown` is what the schema parses
   * an absent or unrecognised value to, deliberately, so it is never read as
   * "open".
   */
  audience?: "public" | "private" | "unknown";
  house?: {
    visibility?: "public" | "private";
    viewerIsMember?: boolean;
  } | null;
}

/**
 * MAY THIS ROOM'S CHAT BE SIGNALLED ON A PUBLIC SOCKET TOPIC?
 *
 * Stricter than `mayShowRoomChat`, and the difference is the whole point.
 *
 * The room's realtime topic is `market-square:stream:<id>`, which matches the
 * `<service>:<channel>` shape the gateway treats as PUBLIC — anyone who opens
 * a socket may subscribe, with no grant. That is fine for a room whose chat is
 * already readable by anyone: a signal about it tells nobody anything they
 * could not simply fetch.
 *
 * It is NOT fine for a room whose chat is gated. The frame carries no words —
 * that rule is absolute and tested — but a subscriber would still learn WHEN a
 * private house's room is active and HOW OFTEN people speak in it, about a
 * room whose entire purpose is that outsiders cannot see in. "Nothing readable
 * leaked" is not the same as "nothing leaked": activity and timing are
 * information, and they are exactly the information a private room is keeping.
 *
 * ─── THE SENTENCE THIS RULE EXISTS FOR ───────────────────────────────────────
 * A MEMBER MAY READ A PRIVATE HOUSE'S CHAT; NOBODY MAY BROADCAST THAT IT IS
 * BUSY. Those look like the same question and are not, which is why this was
 * once a second predicate asserted against its twin. The twin is gone — the
 * service answers that half now — so the sentence lives here, where the next
 * person meets it, instead of in a test for a function nothing calls.
 *
 * ─── WHY MEMBERSHIP DOES NOT RESCUE IT ───────────────────────────────────────
 * `mayShowRoomChat` lets a MEMBER see a private house's chat, because that
 * reader is entitled to it. That exception cannot apply here. A public topic
 * is not subscribed per-reader — publishing to it exposes it to everyone at
 * once, so the question is not "may THIS reader know" but "may ANYONE". One
 * entitled member does not make a topic safe to broadcast.
 *
 * A room that fails this keeps its interval. That is the honest trade: gated
 * rooms are the rare case, and the alternative is a grant-required topic,
 * which is a larger piece of work than the saving it would buy.
 */
export function maySignalRoomChat(stream: RoomChatSubject | null | undefined): boolean {
  if (!stream) return false;
  /*
    THIS MIRRORS THE SERVICE'S OWN `signalableRoom`, FIELD FOR FIELD:
    `visibility === 'public' && audience === 'public'`. It is not an
    independent judgement and must not drift into one — the service decides
    whether a frame EXISTS, so a client that is more permissive subscribes to a
    topic nobody writes to, and one that is more restrictive silently misses
    signals that were sent. Neither is dangerous; both are wrong.

    It does NOT read the house, and that is the deliberate difference from the
    display gate above. `audience` already answers "is this room gated to its
    house" and it is the field the service gates on; adding a doorplate check
    here would make this stricter than the publisher and lose real frames.

    The one place the two ends differ is an ABSENT audience: the service reads
    a missing value as public, this schema parses it to `unknown` and refuses.
    That is left as-is rather than matched. A safety rule should not adopt
    somebody else's optimistic default, and the divergence can only appear on a
    payload that omits the field — which the running service does not send.
  */
  return stream.visibility === "public" && stream.audience === "public";
}
