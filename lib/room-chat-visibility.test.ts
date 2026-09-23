import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mayShowRoomChat, maySignalRoomChat } from "./room-chat-visibility.ts";

/*
  These are BEHAVIOURAL tests, not source-text pins, because this is the one
  piece of the feature that is logic rather than layout — and it is the piece
  that decides whether a private conversation reaches the open internet.

  The room chat read is anonymous (`GET /streams/:id/chat` answers 200 with no
  token, verified against production), so nothing upstream is protecting this.
  Every refusal below is the only thing standing between a private room and a
  public post.
*/
describe("Whose room chat may appear on a public post", () => {
  it("shows an ordinary public room with no house", () => {
    assert.equal(mayShowRoomChat({ visibility: "public", audience: "public", house: null }), true);
  });

  /*
    NO DOORPLATE IS NOT NO GATE. `house` rides only on the single-room read, so
    its absence means "this payload does not describe a house", never "this
    room has none". `audience` is what the SERVICE gates on and it is always
    sent — so with no doorplate to check membership against, an audience that
    is private or merely unstated must refuse.
  */
  it("refuses a room with no doorplate unless its audience is stated public", () => {
    assert.equal(mayShowRoomChat({ visibility: "public", house: null }), false, "absent audience is not public");
    assert.equal(mayShowRoomChat({ visibility: "public", audience: "private", house: null }), false);
    assert.equal(mayShowRoomChat({ visibility: "public", audience: "unknown", house: null }), false);
  });

  it("shows a room in a PUBLIC house to anybody, member or not", () => {
    const house = { visibility: "public" as const, viewerIsMember: false };
    assert.equal(mayShowRoomChat({ visibility: "public", audience: "public", house }), true);
  });

  /*
    The commercial refusal. A ticketed room's chat is part of what the ticket
    buys; printing it free on a post undercuts the host who priced it. It
    refuses regardless of the house, because the ticket is the reason.
  */
  it("refuses a TICKETED room, whose chat is what the ticket buys", () => {
    assert.equal(mayShowRoomChat({ visibility: "ticketed", house: null }), false);
    assert.equal(
      mayShowRoomChat({
        visibility: "ticketed",
        house: { visibility: "public", viewerIsMember: true },
      }),
      false,
      "a ticket is a ticket even in a house the reader belongs to"
    );
  });

  /*
    The privacy refusal, and the reason the whole file exists. A private
    house's room is a conversation among people who joined it; a post shows it
    to everyone deliberately kept out.
  */
  it("refuses a room in a PRIVATE house to someone who is not a member", () => {
    assert.equal(
      mayShowRoomChat({
        visibility: "public",
        house: { visibility: "private", viewerIsMember: false },
      }),
      false
    );
  });

  it("shows a private house's room to a MEMBER, who is already entitled to it", () => {
    assert.equal(
      mayShowRoomChat({
        visibility: "public",
        house: { visibility: "private", viewerIsMember: true },
      }),
      true
    );
  });

  /*
    FAIL CLOSED. Each of these is a payload this could really receive — an
    older service, a partial doorplate, a room that has not loaded yet — and
    every one of them must refuse rather than guess. The cost of a false
    negative is a quieter post; the cost of a false positive is a private
    conversation on the open internet.
  */
  it("refuses anything it cannot positively clear", () => {
    assert.equal(mayShowRoomChat(null), false, "not loaded is not permission");
    assert.equal(mayShowRoomChat(undefined), false);
    assert.equal(
      mayShowRoomChat({ visibility: "public", house: {} }),
      false,
      "a house whose visibility is absent parses as private and must refuse"
    );
    assert.equal(
      mayShowRoomChat({ visibility: "public", house: { visibility: "private" } }),
      false,
      "absent membership is not membership"
    );
  });

  /*
    An explicit guard against the tempting simplification. Somebody reading
    this quickly may reduce it to "is the house public?", which silently drops
    the ticketed case, or to "is the stream public?", which silently drops the
    private-house case. Each rule catches something the other cannot, so both
    directions are asserted here rather than described in a comment.
  */
  it("keeps both rules, because neither one subsumes the other", () => {
    // Public stream, private house — only the house rule catches this.
    assert.equal(
      mayShowRoomChat({
        visibility: "public",
        house: { visibility: "private", viewerIsMember: false },
      }),
      false
    );
    // Ticketed stream, public house — only the ticket rule catches this.
    assert.equal(
      mayShowRoomChat({
        visibility: "ticketed",
        house: { visibility: "public", viewerIsMember: true },
      }),
      false
    );
  });
});

/*
  THE SIGNAL GATE IS STRICTER THAN THE DISPLAY GATE, and the gap is the point:
  a public socket topic is broadcast to everyone at once, so "may this reader
  know" is the wrong question — it is "may ANYONE". One entitled member cannot
  make a topic safe to publish.
*/
describe("Whose room may be announced on a public socket topic", () => {
  it("signals an ordinary public room", () => {
    assert.equal(maySignalRoomChat({ visibility: "public", audience: "public", house: null }), true);
    assert.equal(
      maySignalRoomChat({
        visibility: "public",
        audience: "public",
        house: { visibility: "public", viewerIsMember: false },
      }),
      true
    );
  });

  /*
    IT MIRRORS THE SERVICE, FIELD FOR FIELD — `visibility` and `audience`, and
    NOT the house. The service decides whether a frame exists, so a client that
    is stricter silently misses signals that were sent. This asserts the
    difference from the display gate in the direction that would be easy to
    "tidy up": a private house does not by itself silence the topic; a private
    AUDIENCE does.
  */
  it("gates on the audience the service gates on, not on the doorplate", () => {
    assert.equal(
      maySignalRoomChat({ visibility: "public", audience: "private", house: null }),
      false,
      "a house-gated room is never announced"
    );
    assert.equal(
      maySignalRoomChat({ visibility: "public", audience: "public", house: { visibility: "private" } }),
      true,
      "stricter than the publisher would lose real frames"
    );
  });

  it("never signals a ticketed room", () => {
    assert.equal(maySignalRoomChat({ visibility: "ticketed", house: null }), false);
  });

  /*
    The divergence, asserted as a PAIR so nobody later "simplifies" the two
    predicates into one. A member may SEE a private house's chat; nobody may
    BROADCAST that the room is busy, because the topic reaches outsiders too.
  */
  it("refuses a private house even to a member, where the display gate allows it", () => {
    const room = {
      visibility: "public" as const,
      audience: "private" as const,
      house: { visibility: "private" as const, viewerIsMember: true },
    };
    assert.equal(mayShowRoomChat(room), true, "a member may read it");
    assert.equal(maySignalRoomChat(room), false, "but nobody may announce it on a public topic");
  });

  it("fails closed on anything it cannot positively clear", () => {
    assert.equal(maySignalRoomChat(null), false);
    assert.equal(maySignalRoomChat({ visibility: "public", house: {} }), false, "absent audience refuses");
    assert.equal(maySignalRoomChat({ visibility: "public", audience: "unknown", house: null }), false);
    assert.equal(maySignalRoomChat({ visibility: "ticketed", audience: "public", house: null }), false);
  });
});
