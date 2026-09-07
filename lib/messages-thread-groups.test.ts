import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayLabel,
  formatClockTime,
  groupBySender,
  groupMessagesByDay,
} from "../features/messages/lib/thread-groups.ts";

// Fixtures are built through the LOCAL Date constructor and handed back as
// ISO, so every assertion holds in whatever timezone the test runs in — the
// local-to-UTC shift cancels out. Dates are mid-month and mid-afternoon to stay
// clear of daylight-saving boundaries.
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

const NOW = new Date(2026, 7, 15, 18, 30).getTime(); // 15 August 2026, local

const msg = (createdAt: string, id = createdAt) => ({ id, createdAt });

test("labels today and yesterday by calendar day, not by elapsed hours", () => {
  assert.equal(dayLabel(at(2026, 8, 15, 1, 5), NOW), "Today");
  assert.equal(dayLabel(at(2026, 8, 15, 23, 59), NOW), "Today");
  // 23 hours earlier, but a different calendar day — the separator has to say
  // "Yesterday" or the thread reads as one long today.
  assert.equal(dayLabel(at(2026, 8, 14, 19, 30), NOW), "Yesterday");
  assert.equal(dayLabel(at(2026, 8, 14, 0, 1), NOW), "Yesterday");
});

test("older days get a date, and the year only when it is not this one", () => {
  assert.equal(dayLabel(at(2026, 8, 12), NOW), "August 12");
  assert.equal(dayLabel(at(2026, 3, 2), NOW), "March 2");
  assert.equal(dayLabel(at(2025, 12, 24), NOW), "December 24, 2025");
});

test("an unreadable timestamp yields no label rather than throwing", () => {
  assert.equal(dayLabel("not-a-date", NOW), "");
  assert.equal(formatClockTime("not-a-date"), "");
});

test("clock times are 24-hour and zero-padded on both sides", () => {
  assert.equal(formatClockTime(at(2026, 8, 15, 17, 25)), "17:25");
  assert.equal(formatClockTime(at(2026, 8, 15, 4, 7)), "04:07");
  assert.equal(formatClockTime(at(2026, 8, 15, 0, 0)), "00:00");
  // The design's clock never rolls over to 12; a US locale must not turn this
  // into "9:38 PM".
  assert.equal(formatClockTime(at(2026, 8, 15, 21, 38)), "21:38");
});

test("groups a thread into one section per day, in thread order", () => {
  const groups = groupMessagesByDay(
    [
      msg(at(2026, 8, 14, 17, 25), "a"),
      msg(at(2026, 8, 14, 21, 38), "b"),
      msg(at(2026, 8, 15, 4, 7), "c"),
    ],
    NOW
  );

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((group) => group.label),
    ["Yesterday", "Today"]
  );
  assert.deepEqual(
    groups.map((group) => group.messages.map((message) => message.id)),
    [["a", "b"], ["c"]]
  );
});

test("group keys are the local calendar day, so they are stable React keys", () => {
  const groups = groupMessagesByDay([msg(at(2026, 8, 14, 17, 25))], NOW);
  assert.equal(groups[0].key, "2026-08-14");
});

test("an empty thread produces no sections at all", () => {
  assert.deepEqual(groupMessagesByDay([], NOW), []);
});

test("an out-of-order message stays beside its neighbours instead of moving", () => {
  // Consecutive runs on purpose: the repeated "Today" is visible and honest,
  // where bucketing would file the stray message under a heading it never
  // arrived under.
  const groups = groupMessagesByDay(
    [
      msg(at(2026, 8, 15, 9, 0), "a"),
      msg(at(2026, 8, 14, 9, 0), "b"),
      msg(at(2026, 8, 15, 10, 0), "c"),
    ],
    NOW
  );

  assert.deepEqual(
    groups.map((group) => group.label),
    ["Today", "Yesterday", "Today"]
  );
});

test("a message with an unreadable timestamp still gets rendered somewhere", () => {
  const groups = groupMessagesByDay([msg("nonsense", "a"), msg(at(2026, 8, 15), "b")], NOW);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].key, "unknown");
  assert.equal(groups[0].label, "");
  assert.deepEqual(
    groups[0].messages.map((message) => message.id),
    ["a"]
  );
});

// ── Sender runs ──────────────────────────────────────────────────────────────
// The river's rhythm is two numbers, not one: 16px inside a run of consecutive
// messages from one person, 24px between runs and under the day separator.

const from = (senderId: string, id: string) => ({ id, senderId });

test("consecutive messages from one sender are one run", () => {
  const runs = groupBySender([
    from("a", "m1"),
    from("a", "m2"),
    from("b", "m3"),
    from("a", "m4"),
  ]);

  assert.deepEqual(
    runs.map((run) => [run.senderId, run.messages.map((m) => m.id)]),
    [
      ["a", ["m1", "m2"]],
      ["b", ["m3"]],
      // NOT merged back into the first run: two things A said either side of
      // B's reply are two turns, and bucketing by sender would reorder the
      // conversation to put them together.
      ["a", ["m4"]],
    ]
  );
});

test("a run is keyed on its first message, not on an index", () => {
  // The thread refetches every 5 seconds; an index key remounts every run
  // whenever a message lands at the top of the day.
  assert.deepEqual(
    groupBySender([from("a", "m1"), from("b", "m2")]).map((run) => run.key),
    ["m1", "m2"]
  );
});

test("an empty thread has no runs, and a missing sender id is still a run", () => {
  assert.deepEqual(groupBySender([]), []);
  // The schema defaults `senderId` to "" for a payload that omits it. That
  // must degrade to one long run rather than throwing.
  const runs = groupBySender([from("", "m1"), from("", "m2")]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].messages.length, 2);
});
