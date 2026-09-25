import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maySignalRoomChat } from "./room-chat-visibility.ts";

/*
  These are BEHAVIOURAL tests, not source-text pins, because this is the one
  piece of the feature that is logic rather than layout — and it is the piece
  that decides whether a private conversation reaches the open internet.

  The room chat read is anonymous (`GET /streams/:id/chat` answers 200 with no
  token, verified against production), so nothing upstream is protecting this.
  Every refusal below is the only thing standing between a private room and a
  public post.
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

  it("fails closed on anything it cannot positively clear", () => {
    assert.equal(maySignalRoomChat(null), false);
    assert.equal(maySignalRoomChat({ visibility: "public", house: {} }), false, "absent audience refuses");
    assert.equal(maySignalRoomChat({ visibility: "public", audience: "unknown", house: null }), false);
    assert.equal(maySignalRoomChat({ visibility: "ticketed", audience: "public", house: null }), false);
  });
});
