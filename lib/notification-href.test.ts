import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isGistRoomNotification, notificationHref } from "./notification-href.ts";

const ROOM_ID = "01a0a04d-c80c-7000-9afe-63d791f31488";

describe("a gist room notification never opens the broadcast player", () => {
  // The exact row ogazboiz reported: "Gist room opened — preach opened a gist
  // room in Square Talk", which landed on /live/<id> and rendered "This stream
  // has ended" under a header that still said HOUSE.
  it("routes the reported row to the room, not to /live/", () => {
    assert.equal(
      notificationHref({
        kind: "house_room",
        streamId: ROOM_ID,
        subject: { kind: "room" },
        house: { conversationId: "cv_square_talk" },
      }),
      `/square/gist-rooms/${ROOM_ID}`
    );
  });

  it("trusts the service's own subject.kind", () => {
    assert.equal(
      notificationHref({ kind: "speaker_request", streamId: ROOM_ID, subject: { kind: "room" } }),
      `/square/gist-rooms/${ROOM_ID}`
    );
  });

  it("still routes a room when the payload carries no subject at all", () => {
    // `subject` is served but undocumented, and deployed environments lag. A
    // row without it must not fall back to the wrong surface.
    assert.equal(
      notificationHref({ kind: "house_room", streamId: ROOM_ID }),
      `/square/gist-rooms/${ROOM_ID}`
    );
  });

  it("still routes a room when only the house is named", () => {
    assert.equal(
      notificationHref({
        kind: "unknown_future_room_kind",
        streamId: ROOM_ID,
        house: { conversationId: "cv_square_talk" },
      }),
      `/square/gist-rooms/${ROOM_ID}`
    );
  });
});

describe("a broadcast still opens the player", () => {
  it("sends a live stream to /live/", () => {
    assert.equal(
      notificationHref({ kind: "stream_live", streamId: "st_1", subject: { kind: "stream" } }),
      "/square/live/st_1"
    );
  });

  it("sends a speaker request on a VIDEO stream to /live/", () => {
    // Naming `speaker_request` as a room kind would break exactly this row.
    assert.equal(
      notificationHref({ kind: "speaker_request", streamId: "st_1", subject: { kind: "stream" } }),
      "/square/live/st_1"
    );
  });

  it("defaults an unclassified stream row to the player", () => {
    assert.equal(notificationHref({ kind: "stream_live", streamId: "st_1" }), "/square/live/st_1");
  });
});

describe("isGistRoomNotification", () => {
  it("accepts any one of the three signals on its own", () => {
    assert.equal(isGistRoomNotification({ kind: "x", subject: { kind: "room" } }), true);
    assert.equal(isGistRoomNotification({ kind: "house_room" }), true);
    assert.equal(isGistRoomNotification({ kind: "x", house: { conversationId: "c" } }), true);
  });

  it("is false for a broadcast and for a row about nothing", () => {
    assert.equal(isGistRoomNotification({ kind: "stream_live", subject: { kind: "stream" } }), false);
    assert.equal(isGistRoomNotification({ kind: "follow" }), false);
    assert.equal(isGistRoomNotification({ kind: "follow", house: null, subject: null }), false);
  });
});

describe("every other destination is unchanged", () => {
  it("sends chat events to the inbox, not to the sender's profile", () => {
    assert.equal(notificationHref({ kind: "message", actor: { id: "u1" } }), "/square/messages");
    assert.equal(notificationHref({ kind: "chat_request", actor: { id: "u1" } }), "/square/messages");
  });

  it("opens a post, and opens ON a comment when one is named", () => {
    assert.equal(notificationHref({ kind: "like", postId: "p1" }), "/square/p/p1");
    assert.equal(
      notificationHref({ kind: "comment", postId: "p1", commentId: "c 1/2" }),
      "/square/p/p1?comment=c%201%2F2"
    );
  });

  it("falls back to the actor by id, then to nothing", () => {
    assert.equal(notificationHref({ kind: "follow", actor: { id: "u1", username: "ada" } }), "/square/u/u1");
    assert.equal(notificationHref({ kind: "follow" }), null);
  });

  it("prefers the stream over the post when a row carries both", () => {
    // Order is load-bearing: a room announcement that also names a post is
    // still about the room.
    assert.equal(
      notificationHref({ kind: "house_room", streamId: ROOM_ID, postId: "p1" }),
      `/square/gist-rooms/${ROOM_ID}`
    );
  });
});
