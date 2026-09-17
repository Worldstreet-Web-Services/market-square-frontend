import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEAT_AVATAR,
  SEAT_COUNT,
  SEAT_POSITIONS,
  SEAT_RADIUS,
  buildSeating,
  nextFreeSeat,
  seatsFull,
} from "../features/houses/lib/seating.ts";
import type { StageSlot } from "../features/streams/lib/stage.ts";

/**
 * The table is a set of PLACES, not a list of people.
 *
 * Every case below is a rule about where somebody sits rather than about who
 * is publishing — `buildStage()` already answers that and is pinned by
 * lib/stage.test.ts. What is asserted here is the difference between a stage
 * and a table: the head of the table is reserved, seats keep their index while
 * they are empty, and a publisher the ring cannot hold is still returned.
 */
function slot(identity: string, role: "host" | "guest"): StageSlot {
  return {
    identity,
    role,
    isLocal: false,
    name: identity,
    metadata: null,
    cameraTrack: null,
    screenTrack: null,
    audioTrack: null,
    isSpeaking: false,
    isMuted: false,
    mutedByHost: false,
    cameraOff: true,
    connectionQuality: "unknown",
    state: "live",
  };
}

describe("buildSeating", () => {
  it("always gives seat 0 to the host", () => {
    const { seats } = buildSeating([slot("host", "host"), slot("a", "guest")]);
    assert.equal(seats[0].kind, "host");
    assert.equal(seats[0].slot?.identity, "host");
  });

  it("leaves seat 0 EMPTY when the host is not publishing, rather than promoting a guest", () => {
    // The failure this forbids: a host who mutes, drops or steps backstage and
    // returns to find somebody else in the chair at the head of their table.
    const { seats } = buildSeating([slot("a", "guest"), slot("b", "guest")]);
    assert.equal(seats[0].kind, "empty");
    assert.equal(seats[0].slot, null);
    assert.equal(seats[1].slot?.identity, "a");
    assert.equal(seats[2].slot?.identity, "b");
  });

  it("fills guests from seat 1 in the order buildStage gave them", () => {
    const { seats } = buildSeating([
      slot("host", "host"),
      slot("first", "guest"),
      slot("second", "guest"),
      slot("third", "guest"),
    ]);
    assert.deepEqual(
      seats.slice(1, 4).map((seat) => seat.slot?.identity),
      ["first", "second", "third"]
    );
  });

  it("keeps a fixed number of seats, and empty ones keep their index", () => {
    const { seats } = buildSeating([slot("host", "host")]);
    assert.equal(seats.length, SEAT_COUNT);
    assert.deepEqual(
      seats.map((seat) => seat.index),
      [0, 1, 2, 3, 4, 5, 6, 7]
    );
    for (const seat of seats.slice(1)) assert.equal(seat.kind, "empty");
  });

  it("returns publishers past the last seat as overflow and never drops them", () => {
    // The backend does not enforce a seat count, so this CAN happen. A speaker
    // the room can hear and cannot see is worse than a row nobody designed.
    const slots = [
      slot("host", "host"),
      ...Array.from({ length: 9 }, (_, i) => slot(`g${i}`, "guest")),
    ];
    const { seats, overflow } = buildSeating(slots);
    assert.equal(seats.filter((seat) => seat.slot !== null).length, SEAT_COUNT);
    assert.deepEqual(
      overflow.map((s) => s.identity),
      ["g7", "g8"]
    );
    const rendered = new Set([
      ...seats.flatMap((seat) => (seat.slot ? [seat.slot.identity] : [])),
      ...overflow.map((s) => s.identity),
    ]);
    assert.equal(rendered.size, slots.length);
  });
});

describe("nextFreeSeat", () => {
  it("is the lowest free GUEST seat — the head of the table is never on offer", () => {
    const seating = buildSeating([slot("a", "guest")]);
    assert.equal(seating.seats[0].kind, "empty");
    assert.equal(nextFreeSeat(seating)?.index, 2);
  });

  it("is null once every guest seat is taken", () => {
    const seating = buildSeating([
      slot("host", "host"),
      ...Array.from({ length: SEAT_COUNT - 1 }, (_, i) => slot(`g${i}`, "guest")),
    ]);
    assert.equal(nextFreeSeat(seating), null);
  });
});

describe("seatsFull", () => {
  it("is true when the guest seats are taken even though seat 0 is empty", () => {
    // The bug this pins: a host away from their mic made `some(empty)` answer
    // "there is room", and every Approve then failed against a full table.
    const seating = buildSeating(
      Array.from({ length: SEAT_COUNT - 1 }, (_, i) => slot(`g${i}`, "guest"))
    );
    assert.equal(seating.seats[0].kind, "empty");
    assert.equal(seatsFull(seating), true);
  });

  it("is false while a guest seat is free", () => {
    assert.equal(seatsFull(buildSeating([slot("host", "host")])), false);
  });
});

describe("SEAT_POSITIONS", () => {
  it("carries one position per seat", () => {
    assert.equal(SEAT_POSITIONS.length, SEAT_COUNT);
  });

  it("places every seat on one circle, so no chair reads as nearer the middle", () => {
    for (const point of SEAT_POSITIONS) {
      const radius = Math.hypot(point.x - 50, point.y - 50);
      assert.ok(Math.abs(radius - SEAT_RADIUS) < 0.5, `radius ${radius} for ${JSON.stringify(point)}`);
    }
  });

  it("starts at twelve o'clock and runs clockwise", () => {
    assert.deepEqual(SEAT_POSITIONS[0], { x: 50, y: 50 - SEAT_RADIUS });
    assert.ok(SEAT_POSITIONS[2].x > 50 && Math.abs(SEAT_POSITIONS[2].y - 50) < 0.5);
    assert.ok(SEAT_POSITIONS[6].x < 50 && Math.abs(SEAT_POSITIONS[6].y - 50) < 0.5);
  });

  it("leaves room for a seat's whole cell between the two seats stacked vertically", () => {
    // The bug this pins: at radius 35 with a 72px avatar, adjacent centres are
    // 91px apart and a seat's cell — avatar, name, chip — is 96px tall, so
    // every name ran under the next avatar round the ring. Invisible in a mock
    // with one person in it; unmissable in a browser with four.
    const BOX = 340;
    const gapBelowAvatar = 4;
    const nameLine = 14;
    const chipLine = 16;
    const cell = SEAT_AVATAR + gapBelowAvatar + nameLine + chipLine;
    const dy = Math.abs(SEAT_POSITIONS[2].y - SEAT_POSITIONS[1].y) * (BOX / 100);
    assert.ok(dy > cell, `seats 1 and 2 are ${dy}px apart but a cell is ${cell}px tall`);
  });

  it("keeps the outermost seat inside the box it is laid out in", () => {
    const BOX = 340;
    for (const point of SEAT_POSITIONS) {
      for (const axis of [point.x, point.y]) {
        const edge = (axis / 100) * BOX + SEAT_AVATAR / 2;
        assert.ok(edge <= BOX, `a seat's avatar reaches ${edge}px of ${BOX}px`);
        assert.ok((axis / 100) * BOX - SEAT_AVATAR / 2 >= 0);
      }
    }
  });
});
