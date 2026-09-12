import { test } from "node:test";
import assert from "node:assert/strict";
import { friendsMomentCopy, pickFriendsMoment, pickFriendsMoments, type FriendsMomentInput } from "./friends-popup.ts";

const fola = { id: "u2", username: "fola", displayName: "Fola", avatarUrl: null };
const row = (over: Partial<FriendsMomentInput> & { kind: string }): FriendsMomentInput => ({
  id: over.id ?? "n1",
  readAt: null,
  actor: fola,
  ...over,
});

test("a follow from somebody the viewer already follows is a friends moment", () => {
  const m = pickFriendsMoment([row({ kind: "follow", actor: { ...fola, isFollowing: true } })]);
  assert.equal(m?.kind, "friends");
  assert.deepEqual(m?.notificationIds, ["n1"]);
});

test("a follow from a stranger is not a moment", () => {
  assert.equal(pickFriendsMoment([row({ kind: "follow", actor: { ...fola, isFollowing: false } })]), null);
});

test("a wink is a first wink unless the viewer had already winked", () => {
  assert.equal(pickFriendsMoment([row({ kind: "wink" })])?.kind, "wink");
  assert.equal(pickFriendsMoment([row({ kind: "wink", actor: { ...fola, winkedByMe: false } })])?.kind, "wink");
  assert.equal(pickFriendsMoment([row({ kind: "wink", actor: { ...fola, winkedByMe: true } })])?.kind, "mutual-wink");
});

test("read rows and rows without an actor never qualify", () => {
  assert.equal(pickFriendsMoment([row({ kind: "wink", readAt: "2026-09-09T00:00:00Z" })]), null);
  assert.equal(pickFriendsMoment([row({ kind: "wink", actor: null })]), null);
});

test("friends outranks winks, and every row about that person in the family is gathered", () => {
  const m = pickFriendsMoment([
    row({ id: "w1", kind: "wink" }),
    row({ id: "f1", kind: "follow", actor: { ...fola, isFollowing: true } }),
    row({ id: "f2", kind: "follow", actor: { ...fola, isFollowing: true } }),
  ]);
  assert.equal(m?.kind, "friends");
  assert.deepEqual(m?.notificationIds, ["f1", "f2"]);
});

test("the copy follows the file for friends and changes the button on a mutual wink", () => {
  const friends = friendsMomentCopy({ kind: "friends", actor: fola, notificationIds: [] }, "Fola");
  assert.equal(friends.headline.map((r) => r.text).join(""), "You and Fola are now friends now!");
  assert.equal(friends.primary, "start-gisting");
  assert.equal(friends.secondary, "wink");
  assert.equal(friends.faces, "both");

  const mutual = friendsMomentCopy(
    { kind: "mutual-wink", actor: { ...fola, isFollowing: false }, notificationIds: [] },
    "Fola"
  );
  assert.equal(mutual.primary, "follow-back");
  assert.equal(mutual.faces, "both");

  const wink = friendsMomentCopy({ kind: "wink", actor: fola, notificationIds: [] }, "Fola");
  assert.equal(wink.primary, "wink-back");
  assert.equal(wink.faces, "theirs");
});

test("the fan is one card per person, best moment first, rows of the family gathered", () => {
  const ade = { id: "u3", username: "ade", displayName: "Ade", avatarUrl: null };
  const fan = pickFriendsMoments([
    row({ id: "w1", kind: "wink", actor: ade }),
    row({ id: "f1", kind: "follow", actor: { ...fola, isFollowing: true } }),
    row({ id: "w2", kind: "wink", actor: { ...fola, winkedByMe: true } }),
    row({ id: "f2", kind: "follow", actor: { ...ade, isFollowing: false } }),
  ]);
  assert.deepEqual(
    fan.map((m) => [m.actor.id, m.kind, m.notificationIds]),
    [
      ["u2", "friends", ["f1"]],
      ["u3", "wink", ["w1"]],
    ]
  );
  assert.equal(pickFriendsMoment([]), null);
});
