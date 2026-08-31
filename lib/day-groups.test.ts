import assert from "node:assert/strict";
import { test } from "node:test";
import { clockTime, groupByDay } from "../features/messages/lib/day-groups.ts";

const NOW = new Date("2026-08-31T12:00:00");
const msg = (createdAt: string) => ({ createdAt });

test("labels today and yesterday", () => {
  const groups = groupByDay(
    [msg("2026-08-30T21:38:00"), msg("2026-08-31T09:15:00")],
    NOW
  );
  assert.deepEqual(
    groups.map((g) => g.label),
    ["Yesterday", "Today"]
  );
});

test("splits on LOCAL midnight, not on elapsed hours", () => {
  // 23:59 and 00:01 are two minutes apart and belong to different days to
  // every person reading them. An hours-based rule would group them.
  const groups = groupByDay([msg("2026-08-30T23:59:00"), msg("2026-08-31T00:01:00")], NOW);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.label),
    ["Yesterday", "Today"]
  );
});

test("keeps consecutive messages from one day in one group, in order", () => {
  const groups = groupByDay(
    [msg("2026-08-31T09:00:00"), msg("2026-08-31T10:00:00"), msg("2026-08-31T11:00:00")],
    NOW
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.items.length, 3);
});

test("older days are written out, and only carry a year when it is not this one", () => {
  const [thisYear] = groupByDay([msg("2026-03-03T10:00:00")], NOW);
  assert.ok(!thisYear!.label.includes("2026"), thisYear!.label);
  const [lastYear] = groupByDay([msg("2025-03-03T10:00:00")], NOW);
  assert.ok(lastYear!.label.includes("2025"), lastYear!.label);
});

test("a message with an unreadable timestamp is kept, not dropped", () => {
  // A message that exists must be readable even when its clock is not.
  const groups = groupByDay([msg("not-a-date")], NOW);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.label, "Earlier");
  assert.equal(groups[0]!.items.length, 1);
});

test("group keys are stable and distinct per day", () => {
  const groups = groupByDay([msg("2026-08-30T10:00:00"), msg("2026-08-31T10:00:00")], NOW);
  assert.notEqual(groups[0]!.key, groups[1]!.key);
});

test("clockTime prints a 24-hour clock, and nothing for junk", () => {
  assert.match(clockTime("2026-08-31T17:25:00"), /^\d{2}:\d{2}$/);
  assert.equal(clockTime("not-a-date"), "");
});
