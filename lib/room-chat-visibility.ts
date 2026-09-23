/**
 * MAY THIS ROOM'S CHAT BE SHOWN ON A POST IN THE FEED?
 *
 * The feature exists to create curiosity: a post that shows what people are
 * saying in the room is a reason to open the room (ogazboiz, 2026-09-23:
 * "whatever they comment in the gist room should be showing in that post
 * comment to bring curiosity in that post so people can join the gist room").
 *
 * A post is the most public surface this app has. Signed-out readers see it,
 * it is shared outside the app, and the room's chat read is ANONYMOUS — the
 * service answers `GET /streams/:id/chat` with 200 and no token, verified
 * against production. So nothing upstream stops this from publishing a private
 * conversation to the open internet; the gate has to be here, and it has to be
 * the thing that is careful.
 *
 * TWO WAYS A ROOM'S CHAT IS NOT THE FEED'S TO SHOW, and they are different:
 *
 *   · TICKETED. `visibility` on a stream is `public | ticketed`, not
 *     public/private — a ticketed room is the one people PAY to be in. Its
 *     chat is part of what the ticket buys, so putting it on a free post gives
 *     away the product and undercuts the host who priced it. Refused on
 *     commercial grounds, not privacy ones, and it is still a refusal.
 *
 *   · INSIDE A PRIVATE HOUSE. A room belonging to a private house is a
 *     conversation among people who joined that house. Publishing it on a post
 *     shows it to everyone who was deliberately kept out, which is the exact
 *     harm the house's own privacy setting exists to prevent. A MEMBER may
 *     still see it — they are already entitled to that room — so the test is
 *     the viewer's membership, not the house's setting alone.
 *
 * FAIL CLOSED, AND THE SCHEMA ALREADY DOES. `house.visibility` parses with
 * `.default("private").catch("private")`, so a payload that omits it, or sends
 * something unrecognised, reads as private and this returns false. That is the
 * right direction to be wrong in: the cost of a false negative is a quieter
 * post, and the cost of a false positive is a private conversation on the open
 * internet. They are not comparable, so they are not traded off.
 *
 * A room with NO house (`house: null`) is a standalone public room and is
 * fine — there is no membership to have been excluded from.
 *
 * NOTE the field this reads is only on `GET /streams/:id`, never on a list
 * card. The card fetches the room by id anyway, which is what makes this
 * decidable at all; anything rendering from a list row cannot call this and
 * must not show chat.
 */
export interface RoomChatSubject {
  visibility?: "public" | "ticketed";
  house?: {
    visibility?: "public" | "private";
    viewerIsMember?: boolean;
  } | null;
}

export function mayShowRoomChat(stream: RoomChatSubject | null | undefined): boolean {
  // Nothing to decide about, and "we have not loaded it" is not permission.
  if (!stream) return false;

  // The chat is part of what the ticket buys.
  if (stream.visibility === "ticketed") return false;

  const house = stream.house;
  // No house, no membership to have been excluded from.
  if (!house) return true;

  /*
    STATED PUBLIC, OR A MEMBER. Written as a positive test rather than as
    `if (visibility === "private")`, because the negative form falls THROUGH to
    permission for every value that is not the word "private" — an absent
    field, a null, a new setting the service adds later. Each of those is a
    house this cannot vouch for, and the negative form would publish all of
    them. `.default("private").catch("private")` on the schema means a parsed
    payload always states one of the two, but a safety rule must not depend on
    a default somewhere else to be safe.
  */
  if (house.visibility === "public") return true;
  return house.viewerIsMember === true;
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
  // A ticket gates the chat, so the room's activity is part of what is gated.
  if (stream.visibility === "ticketed") return false;
  const house = stream.house;
  if (!house) return true;
  // Stated public only — the same fail-closed reading as above, and for the
  // stronger reason: here a wrong `true` is broadcast rather than shown to one
  // person.
  return house.visibility === "public";
}
