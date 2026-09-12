import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clockLabel, shortDateLabel, startsInLabel } from "./format.ts";

const now = new Date("2026-09-12T09:00:00Z").getTime();
const inMs = (ms: number) => new Date(now + ms).toISOString();

describe("the upcoming room card's time", () => {
  it("counts down in hours and minutes, days past a week, and never claims a past time", () => {
    assert.equal(startsInLabel(inMs(3 * 3600_000 + 55 * 60_000), now), "Starts in 3h 55m");
    assert.equal(startsInLabel(inMs(203 * 3600_000 + 55 * 60_000), now), "Starts in 8d");
    assert.equal(startsInLabel(inMs(25 * 60_000), now), "Starts in 25m");
    assert.equal(startsInLabel(inMs(30_000), now), "Starting soon");
    assert.equal(startsInLabel("not a date", now), "Starting soon");
  });

  it("stops promising once the host is actually late", () => {
    // The room ogazboiz watched: scheduled 5:13, still shut at 17:26. It read
    // "Starting soon" the whole time, which was a promise nothing was keeping.
    assert.equal(startsInLabel(inMs(-13 * 60_000), now), "Waiting for host");
    assert.equal(startsInLabel(inMs(-3600_000), now), "Waiting for host");
    // Inside the grace a host is plausibly opening right now, so the card
    // does not accuse them the instant the clock ticks over.
    assert.equal(startsInLabel(inMs(-30_000), now), "Starting soon");
    assert.equal(startsInLabel(inMs(-119_000), now), "Starting soon");
  });

  it("writes the clock and the date, and nothing at all for a bad one", () => {
    assert.match(clockLabel(inMs(0)), /\d/);
    assert.match(shortDateLabel(inMs(0)), /2026/);
    assert.equal(clockLabel("nope"), "");
    assert.equal(shortDateLabel("nope"), "");
  });
});
