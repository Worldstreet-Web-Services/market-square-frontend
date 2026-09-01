import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const seat = source("features/houses/components/seat.tsx");
const ring = source("features/houses/components/seat-ring.tsx");

/**
 * The lift is the one moment this feature budgets motion for, and it shipped
 * dead. An empty seat and an occupied one are different components, so a seat
 * MOUNTS when somebody sits down; the original guard skipped the animation
 * whenever its "last seen identity" ref was null, which is exactly what a
 * fresh mount looks like. It never fired for anyone.
 */

test("the lift is decided at mount, from the room — not from a ref that is always null", () => {
  assert.match(
    seat,
    /const \[landing\] = useState\(\(\) => roomSettled\);/,
    "landing must be captured once at mount from the room's state"
  );
  assert.doesNotMatch(
    seat,
    /seen\.current === null/,
    "the null-ref guard is the bug: a fresh mount is indistinguishable from arriving"
  );
});

test("the seat does not set state in an effect to animate", () => {
  // setState inside an effect cascades renders, and the lint rule rejects it.
  assert.doesNotMatch(seat, /setLanding\(/, "no state setter for the landing flag");
});

test("the ring is what knows the room has arrived", () => {
  assert.match(ring, /const \[settled, setSettled\] = useState\(false\);/);
  assert.match(
    ring,
    /requestAnimationFrame\(\(\) => setSettled\(true\)\)/,
    "one paint is exactly the window the initial seats mount in; a duration would be a guess"
  );
  assert.match(ring, /roomSettled=\{settled\}/, "and passes it to every occupied seat");
});
