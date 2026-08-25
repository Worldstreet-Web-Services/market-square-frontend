import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  DuplicateRoomError,
  __resetRooms,
  getRoom,
  registerRoom,
  subscribeRoom,
  unregisterRoom,
} from "../features/streams/lib/live-room.ts";

/**
 * The production bug this guards against: an approved guest speaker opened a
 * SECOND LiveKit Room with the speaker token while still connected as a
 * viewer. Both tokens are minted with the same LiveKit identity, so the new
 * participant evicted the old one, the evicted one reconnected and evicted the
 * new one, and the loop killed the renderer on mobile ("This page couldn't
 * load").
 *
 * A Room is opaque here — the registry only cares about identity of the object.
 */
const roomA = { id: "A" } as never;
const roomB = { id: "B" } as never;

describe("live-room registry", () => {
  beforeEach(() => __resetRooms());

  it("hands out the slot to the first room", () => {
    registerRoom("s1", roomA);
    assert.equal(getRoom("s1"), roomA);
  });

  it("REFUSES a second room for the same stream", () => {
    registerRoom("s1", roomA);
    assert.throws(
      () => registerRoom("s1", roomB),
      DuplicateRoomError,
      "a second Room on one stream connects twice with the same identity and " +
        "starts the eviction loop — it must be refused, not tolerated"
    );
    assert.equal(getRoom("s1"), roomA, "the original room keeps the slot");
  });

  it("re-registering the SAME room is a no-op", () => {
    // React strict mode double-invokes effects; that must not look like a bug.
    registerRoom("s1", roomA);
    registerRoom("s1", roomA);
    assert.equal(getRoom("s1"), roomA);
  });

  it("keeps separate streams independent", () => {
    registerRoom("s1", roomA);
    registerRoom("s2", roomB);
    assert.equal(getRoom("s1"), roomA);
    assert.equal(getRoom("s2"), roomB);
  });

  it("frees the slot on unregister, so a remount can reconnect", () => {
    registerRoom("s1", roomA);
    unregisterRoom("s1", roomA);
    assert.equal(getRoom("s1"), null);
    registerRoom("s1", roomB);
    assert.equal(getRoom("s1"), roomB);
  });

  it("ignores a stale unregister from a room that already lost the slot", () => {
    // Teardown order is not guaranteed: an old room's cleanup must not evict
    // the new room that replaced it.
    registerRoom("s1", roomA);
    unregisterRoom("s1", roomA);
    registerRoom("s1", roomB);
    unregisterRoom("s1", roomA);
    assert.equal(getRoom("s1"), roomB);
  });

  it("notifies subscribers when a room appears and goes", () => {
    let calls = 0;
    const stop = subscribeRoom("s1", () => (calls += 1));
    registerRoom("s1", roomA);
    assert.equal(calls, 1, "the stage panel must learn the room exists");
    unregisterRoom("s1", roomA);
    assert.equal(calls, 2);
    stop();
    registerRoom("s1", roomB);
    assert.equal(calls, 2, "unsubscribed listeners stop firing");
  });
});
