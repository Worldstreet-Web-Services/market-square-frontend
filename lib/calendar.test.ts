import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  composeLocal,
  daysInMonth,
  fieldLabel,
  isPastDay,
  localDateKey,
  monthGrid,
  splitLocal,
  stepMonth,
} from "./calendar.ts";

describe("the gist room date picker's arithmetic", () => {
  it("lays a month out Monday-first, padded to whole weeks", () => {
    // 1 Sep 2026 is a Tuesday, so exactly one blank leads the grid.
    const grid = monthGrid(2026, 9);
    assert.equal(grid.length % 7, 0);
    assert.equal(grid[0].day, null);
    assert.equal(grid[1].day, 1);
    assert.equal(grid[1].iso, "2026-09-01");
    assert.equal(grid.filter((cell) => cell.day !== null).length, 30);
  });

  it("knows February, leap years included", () => {
    assert.equal(daysInMonth(2026, 2), 28);
    assert.equal(daysInMonth(2028, 2), 29);
    assert.equal(monthGrid(2028, 2).filter((c) => c.day).length, 29);
  });

  it("rolls the year over at both ends", () => {
    assert.deepEqual(stepMonth(2026, 12, 1), { year: 2027, month: 1 });
    assert.deepEqual(stepMonth(2026, 1, -1), { year: 2025, month: 12 });
  });

  it("joins and splits the value the sheet already submits", () => {
    assert.equal(composeLocal("2026-09-19", "09:00"), "2026-09-19T09:00");
    assert.deepEqual(splitLocal("2026-09-19T09:00"), { dateKey: "2026-09-19", time: "09:00" });
    // Half a value is no value — never a date defaulted to midnight.
    assert.equal(composeLocal("2026-09-19", ""), "");
    assert.equal(composeLocal("", "09:00"), "");
    assert.deepEqual(splitLocal(""), { dateKey: "", time: "" });
  });

  it("keeps today selectable all day, and rejects yesterday", () => {
    const now = new Date(2026, 8, 12, 23, 30).getTime();
    assert.equal(isPastDay("2026-09-12", now), false, "today expired before midnight");
    assert.equal(isPastDay("2026-09-11", now), true);
    assert.equal(isPastDay("2026-09-13", now), false);
  });

  it("keys a day in LOCAL time, never shifted across UTC", () => {
    // 23:30 local would be the NEXT day in UTC; the key must not move.
    assert.equal(localDateKey(new Date(2026, 8, 12, 23, 30)), "2026-09-12");
    assert.equal(localDateKey(new Date(2026, 0, 1, 0, 30)), "2026-01-01");
  });

  it("labels a chosen moment, and says nothing about a broken one", () => {
    assert.match(fieldLabel("2026-09-19T09:00", "en-GB"), /Sat.*19.*Sep.*2026/);
    assert.equal(fieldLabel("", "en-GB"), "");
    assert.equal(fieldLabel("not-a-date", "en-GB"), "");
  });
});
