import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SEAT_RELEASED_NOTICE, seatPresence, seatReleasedNotice } from "./speaker-seat.ts";

/*
  A dropped speaker keeps the seat for the service's grace window (60 s) and
  is then moved to the audience (ogazboiz, 2026-09-17: "that make sense then
  do that"). The service says so with `removedReason: 'disconnected'`.
*/
describe("a speaker who lost connection is told why they are in the audience", () => {
  const row = (status: string, removedReason: "host" | "disconnected" | null) => ({ status, removedReason });

  it("names the lost connection only when the seat was released for it", () => {
    assert.equal(seatReleasedNotice("approved", row("removed", "disconnected")), SEAT_RELEASED_NOTICE);
    assert.match(SEAT_RELEASED_NOTICE, /lost connection/i);
    assert.match(SEAT_RELEASED_NOTICE, /raise your hand/i);
  });

  it("stays quiet when the host moved them down, or nothing changed", () => {
    assert.equal(seatReleasedNotice("approved", row("removed", "host")), null);
    assert.equal(seatReleasedNotice("approved", row("removed", null)), null);
    assert.equal(seatReleasedNotice("approved", row("approved", null)), null);
    assert.equal(seatReleasedNotice(null, row("removed", "disconnected")), null);
    assert.equal(seatReleasedNotice("removed", row("removed", "disconnected")), null);
  });
});

describe("the host sees a seated speaker who has dropped as reconnecting", () => {
  it("is present when either identity is connected, reconnecting otherwise", () => {
    const present = new Set(["did:privy:a"]);
    assert.equal(seatPresence("did:privy:a", present), "present");
    assert.equal(seatPresence("did:privy:b", present), "reconnecting");
  });

  it("never says reconnecting before the room has been read", () => {
    assert.equal(seatPresence("did:privy:b", null), "present");
  });
});
