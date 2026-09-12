/**
 * The table: how many seats there are, where they sit, and who is in them.
 *
 * `buildStage()` (features/streams/lib/stage.ts) already answers "who has a
 * publish grant", host first, then guests by join order. That is the seating
 * source of truth and this module does not second-guess it — it only maps that
 * list onto a fixed number of PLACES.
 *
 * The distinction matters. A stage is a list that grows and shrinks; a table is
 * a set of seats, and a seat that moves is not a seat. Seat 0 is the host's
 * whether or not the host is publishing, so a guest can never be promoted into
 * the chair at the head of the table by the accident of the host's mic being
 * off.
 *
 * Pure: no React, no SDK, and — deliberately — no VALUE imports. `pnpm test`
 * runs these through Node's native type stripping, which resolves neither the
 * `@/` alias nor an extensionless specifier, so everything a test touches has
 * to stand on its own. That is also why SEAT_COUNT lives here rather than in
 * house.ts: it is a fact about the table, and putting it here keeps both
 * modules independently loadable.
 *
 * Pinned by lib/house-seating.test.ts.
 */

import type { StageSlot } from "@/features/streams/lib/stage";

/**
 * Seats at the table.
 *
 * A REAL product loss against X Spaces' thirteen, and it forecloses a
 * nine-person panel. It is one exported constant and `SEAT_POSITIONS` is a
 * swappable positioning layer (`seat.tsx` does not know it is in a ring), so
 * moving to a 2-across grid at a higher count is a flag rather than a rewrite.
 * Raised with the product owner rather than settled by the ring's geometry.
 */
export const SEAT_COUNT = 8;

export interface Seat {
  /** 0..SEAT_COUNT-1. Seat 0 is the host's, always. */
  index: number;
  kind: "host" | "speaker" | "empty";
  slot: StageSlot | null;
}

export interface Seating {
  seats: Seat[];
  /**
   * Publishers past the last seat.
   *
   * It should never happen — the host tray refuses to approve into a full table
   * — but the backend does not enforce a seat count, so it CAN. Rendered as a
   * plain row under the ring rather than dropped: a speaker the room can hear
   * and cannot see is worse than an overflow row nobody designed.
   */
  overflow: StageSlot[];
}

export function buildSeating(slots: readonly StageSlot[]): Seating {
  const host = slots.find((slot) => slot.role === "host") ?? null;
  const guests = slots.filter((slot) => slot.role !== "host");

  const seats: Seat[] = [
    // The head of the table is reserved, not contested. `empty` here means the
    // host is not publishing (backstage, or their connection dropped) — it
    // never means "the next guest may have it".
    host ? { index: 0, kind: "host", slot: host } : { index: 0, kind: "empty", slot: null },
  ];

  for (let index = 1; index < SEAT_COUNT; index += 1) {
    const guest = guests[index - 1];
    seats.push(
      guest ? { index, kind: "speaker", slot: guest } : { index, kind: "empty", slot: null }
    );
  }

  return { seats, overflow: guests.slice(SEAT_COUNT - 1) };
}

/**
 * True when nobody can be seated without someone standing down first.
 *
 * Defined as "no free GUEST seat", not "no empty seat anywhere". Seat 0 is the
 * host's and is never on offer, so a room whose host has stepped away from
 * their mic — seat 0 `empty`, seats 1..7 taken — is full, and a naive
 * `some(kind === "empty")` would answer that there is room and then have every
 * Approve fail against a table with nowhere to put anyone.
 */
export function seatsFull(seating: Seating): boolean {
  return nextFreeSeat(seating) === null;
}

/**
 * The ONE chair that carries the raise-hand affordance.
 *
 * A single chair, not all of them: the pending state is a property of the ROOM
 * ("somebody may be seated next"), and painting every free chair with a hand
 * would read as several people waiting. Seat 0 is excluded — the head of the
 * table is not on offer.
 */
export function nextFreeSeat(seating: Seating): Seat | null {
  return seating.seats.find((seat) => seat.index > 0 && seat.kind === "empty") ?? null;
}

/** Where the ring sits, as a percentage of the box's half-width. */
export const SEAT_RADIUS = 41;

/**
 * Ring geometry, precomputed.
 *
 * θᵢ = −90° + i·45°, as percentages of the square the ring is laid out in.
 * Constants rather than runtime trigonometry: eight numbers that never change
 * do not need recomputing on every layout, and a table of positions is the
 * swappable layer if SEAT_COUNT ever moves off eight.
 *
 * THE RADIUS IS 41%, NOT 35%, AND THE AVATAR IS 60px, NOT 72px.
 *
 * At 35% and 72px the ring is beautiful and unreadable: adjacent seat centres
 * are 91px apart while a seat's own cell — avatar, then name, then a chip — is
 * 96px tall, so every name ran underneath the next avatar round the ring. It
 * is a collision you cannot see in a mock with one person in it and cannot
 * miss in a browser with four.
 *
 * The controlling pair is (1,2) — the two seats separated mostly vertically.
 * Their centres are 2.4·r px apart on a 340px box, and a seat needs
 *   avatar + gap + name + chip  <  2.4·r
 * which at 60/4/14/16 needs r ≥ 39. 41 leaves a few pixels of air, and keeps
 * the outermost seat (91%, +30px avatar) inside the 340px box.
 */
export const SEAT_POSITIONS: readonly { x: number; y: number }[] = [
  { x: 50, y: 9 },
  { x: 78.99, y: 21.01 },
  { x: 91, y: 50 },
  { x: 78.99, y: 78.99 },
  { x: 50, y: 91 },
  { x: 21.01, y: 78.99 },
  { x: 9, y: 50 },
  { x: 21.01, y: 21.01 },
];

/** The avatar on a seat. Named here because the ring's radius depends on it. */
export const SEAT_AVATAR = 60;
