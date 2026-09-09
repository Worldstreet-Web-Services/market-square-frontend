import assert from "node:assert/strict";
import { test } from "node:test";
import { inboxTime } from "./inbox-time.ts";

/** Local time, built the way the function reads it, so the tests do not depend
    on the host's zone. */
function at(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

const NOW = at(2026, 9, 3, 14, 30).getTime();

test("today carries the clock, zero-padded, in 24-hour form", () => {
  assert.equal(inboxTime(at(2026, 9, 3, 21, 47).toISOString(), at(2026, 9, 3, 23, 0).getTime()), "21:47");
  assert.equal(inboxTime(at(2026, 9, 3, 9, 5).toISOString(), NOW), "09:05");
  assert.equal(inboxTime(at(2026, 9, 3, 0, 0).toISOString(), NOW), "00:00");
});

test("earlier days carry the age, in single-letter units the column can hold", () => {
  assert.equal(inboxTime(at(2026, 9, 1, 10, 0).toISOString(), NOW), "2d");
  assert.equal(inboxTime(at(2026, 8, 29, 10, 0).toISOString(), NOW), "5d");
});

test("the day count is CALENDAR days, so last night is 1d at ten past midnight", () => {
  // 23:50 yesterday, read at 00:10 today: eight hours of wall clock, but one
  // day of calendar. An elapsed-hours bucket would answer "0d".
  const justAfterMidnight = at(2026, 9, 3, 0, 10).getTime();
  assert.equal(inboxTime(at(2026, 9, 2, 23, 50).toISOString(), justAfterMidnight), "1d");
});

test("a week becomes weeks, and a month becomes a date", () => {
  assert.equal(inboxTime(at(2026, 8, 27, 10, 0).toISOString(), NOW), "1w");
  assert.equal(inboxTime(at(2026, 8, 13, 10, 0).toISOString(), NOW), "3w");
  // 5 weeks out, the gap stops being informative.
  assert.equal(inboxTime(at(2026, 7, 20, 10, 0).toISOString(), NOW), "Jul 20");
});

test("the 7-day boundary hands over from days to weeks exactly once", () => {
  assert.equal(inboxTime(at(2026, 8, 28, 10, 0).toISOString(), NOW), "6d");
  assert.equal(inboxTime(at(2026, 8, 27, 10, 0).toISOString(), NOW), "1w");
});

test("nothing to stamp renders nothing, never a fabricated time", () => {
  assert.equal(inboxTime(null), "");
  assert.equal(inboxTime(undefined), "");
  assert.equal(inboxTime(""), "");
  assert.equal(inboxTime("not a date"), "");
});

test("a future stamp is clock skew, and shows the clock rather than a negative age", () => {
  // -1d would be nonsense on a row; the clock is the least misleading thing a
  // server running slightly fast can produce.
  assert.equal(inboxTime(at(2026, 9, 3, 15, 0).toISOString(), NOW), "15:00");
});
