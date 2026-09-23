import test from "node:test";
import assert from "node:assert/strict";
import { liveRoomFaces, ROOM_FACE_LIMIT } from "../features/streams/lib/room-faces.ts";

const ada = { id: "ada", username: "ada" };
const grace = { id: "grace", username: "grace" };
const alan = { id: "alan", username: "alan" };
const edsger = { id: "edsger", username: "edsger" };

/*
  THE BUG THIS FILE EXISTS FOR.

  The live card read `stream.attendees` and drew an empty stack on a room that
  had somebody in it. Nothing failed: `attendees` is `.optional().default([])`,
  so an absent field parses to `[]`, and `[].map(...)` renders nothing at all.
  Typecheck, lint, 2292 tests and the build were all happy with a card that had
  no faces on it.

  `attendees` is the ENDED-room field — its own schema note says "Absent while a
  room is LIVE". Measured against this stack on 2026-09-23:
  `GET /streams?status=live&kind=room` returns `owner` hydrated,
  `participants: []`, and no `attendees` key at all.

  So the rule is pinned here, by behaviour rather than by reading the JSX.
*/

test("the host alone is a face — a live room never looks abandoned", () => {
  // Today's real payload: participants empty, owner hydrated.
  assert.deepEqual(liveRoomFaces({ participants: [], owner: ada }), [ada]);
});

test("who is actually connected comes first, then the host", () => {
  assert.deepEqual(liveRoomFaces({ participants: [grace, alan], owner: ada }), [grace, alan, ada]);
});

test("a host inside their own sample is not drawn twice", () => {
  // The sample is documented as host-first, so this is the ORDINARY case, not
  // an edge one. A face drawn twice reads as a bug.
  assert.deepEqual(liveRoomFaces({ participants: [ada, grace], owner: ada }), [ada, grace]);
});

test("three plates at most, because the card draws three", () => {
  assert.equal(ROOM_FACE_LIMIT, 3);
  assert.deepEqual(liveRoomFaces({ participants: [grace, alan, edsger], owner: ada }), [
    grace,
    alan,
    edsger,
  ]);
});

test("the house roster fills only the places presence and the host left empty", () => {
  // Last tier, and it is the order production has shipped for months: the
  // people the invite is addressed to, when nobody connected is resolvable.
  assert.deepEqual(liveRoomFaces({ participants: [], owner: ada, roster: [grace, alan, edsger] }), [
    ada,
    grace,
    alan,
  ]);
  // Presence still outranks it: a connected stranger beats a house member.
  assert.deepEqual(liveRoomFaces({ participants: [grace], owner: ada, roster: [edsger] }), [
    grace,
    ada,
    edsger,
  ]);
});

test("a host who is also in their own house is not drawn twice", () => {
  assert.deepEqual(liveRoomFaces({ participants: [], owner: ada, roster: [ada, grace] }), [
    ada,
    grace,
  ]);
});

test("a room with nobody resolvable draws nothing rather than a placeholder", () => {
  // An empty stack is honest when there is genuinely no one to name — it is
  // only a bug when somebody IS there, which is what the first test pins.
  assert.deepEqual(liveRoomFaces({ participants: [], owner: null, roster: [] }), []);
  assert.deepEqual(liveRoomFaces({}), []);
});

test("attendees is NEVER a source — it is the ended-room field", () => {
  /*
    The regression, stated as an assertion. If someone re-adds `attendees` to
    the sources, this fails: a room that is live and has an owner would start
    drawing whoever the replay field happens to carry, and — much worse — a
    payload with ONLY attendees would look like it worked.
  */
  const faces = liveRoomFaces({
    participants: [],
    owner: null,
    roster: [],
    // @ts-expect-error — not part of the input type; passed to prove it is ignored.
    attendees: [grace, alan],
  });
  assert.deepEqual(faces, [], "the live card is reading the ended-room field again");
});
