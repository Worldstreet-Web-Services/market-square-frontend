import { test } from "node:test";
import assert from "node:assert/strict";
import { oldestFirst, preservedScrollTop } from "./chat-order.ts";

const m = (id: string, createdAt: string) => ({ id, createdAt });

test("a newest-first page is drawn oldest first", () => {
  const page = [m("c", "2026-09-13T18:35:00Z"), m("b", "2026-09-13T18:34:00Z"), m("a", "2026-09-13T18:09:00Z")];
  assert.deepEqual(
    oldestFirst(page).map((x) => x.id),
    ["a", "b", "c"]
  );
  assert.equal(page[0].id, "c", "the input page is not mutated");
});

test("the polled head and an older history page merge without repeating a message", () => {
  const head = [m("e", "2026-09-13T18:40:00Z"), m("d", "2026-09-13T18:36:00Z"), m("c", "2026-09-13T18:35:00Z")];
  const older = [m("c", "2026-09-13T18:35:00Z"), m("b", "2026-09-13T18:34:00Z"), m("a", "2026-09-13T18:09:00Z")];
  assert.deepEqual(
    oldestFirst(older, head).map((x) => x.id),
    ["a", "b", "c", "d", "e"]
  );
});

test("two messages in the same instant keep one order, by id", () => {
  const same = "2026-09-13T18:35:00.000Z";
  assert.deepEqual(
    oldestFirst([m("02", same), m("01", same)]).map((x) => x.id),
    ["01", "02"]
  );
});

test("an unparseable timestamp sorts as the epoch rather than throwing", () => {
  assert.deepEqual(
    oldestFirst([m("b", "2026-09-13T18:35:00Z"), m("a", "not a date")]).map((x) => x.id),
    ["a", "b"]
  );
});

test("older messages inserted above keep the reader on the same line", () => {
  // 300px of history arrived above a reader sitting 120px down a 1000px list.
  assert.equal(preservedScrollTop(120, 1000, 1300), 420);
  // Nothing arrived: nothing moves.
  assert.equal(preservedScrollTop(120, 1000, 1000), 120);
  // A shrink (a deleted message) never scrolls the reader upward.
  assert.equal(preservedScrollTop(120, 1000, 900), 120);
});
