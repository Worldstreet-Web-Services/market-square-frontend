import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { friendsMomentFor, type FriendsMomentActor } from "./friends-popup.ts";

const actor = (extra: Partial<FriendsMomentActor> = {}): FriendsMomentActor => ({
  id: "u1",
  username: "fola",
  displayName: "Fola",
  avatarUrl: null,
  ...extra,
});

describe("the card one notification row opens", () => {
  it("opens a wink's card whether or not the row has been read", () => {
    assert.deepEqual(friendsMomentFor({ id: "n1", kind: "wink", readAt: null, actor: actor() }), {
      kind: "wink",
      actor: actor(),
      notificationIds: ["n1"],
    });
    assert.equal(
      friendsMomentFor({ id: "n1", kind: "wink", readAt: "2026-09-11T10:00:00Z", actor: actor() })?.kind,
      "wink"
    );
  });

  it("reads a wink the viewer had already sent as a mutual wink", () => {
    assert.equal(
      friendsMomentFor({ id: "n1", kind: "wink", readAt: null, actor: actor({ winkedByMe: true }) })?.kind,
      "mutual-wink"
    );
  });

  it("opens the friends card for a follow-back, and nothing for a one-way follow", () => {
    assert.equal(
      friendsMomentFor({ id: "n1", kind: "follow", readAt: null, actor: actor({ isFollowing: true }) })?.kind,
      "friends"
    );
    assert.equal(friendsMomentFor({ id: "n1", kind: "follow", readAt: null, actor: actor() }), null);
  });

  it("opens nothing for a row that is not about a person meeting you", () => {
    assert.equal(friendsMomentFor({ id: "n1", kind: "like", readAt: null, actor: actor() }), null);
    assert.equal(friendsMomentFor({ id: "n1", kind: "wink", readAt: null, actor: null }), null);
  });
});
