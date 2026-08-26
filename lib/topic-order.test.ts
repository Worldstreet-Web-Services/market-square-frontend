import assert from "node:assert/strict";
import { test } from "node:test";
import { sortTopicsByOrder } from "./topic-order.ts";

const keys = (topics: Array<{ key: string; sortOrder: number }>) => topics.map((t) => t.key);

test("orders by sortOrder, not by the order the array arrived in", () => {
  // The real vocabulary, served scrambled — this is the case that breaks the
  // day a topic is inserted in the middle.
  const scrambled = [
    { key: "crypto", sortOrder: 70 },
    { key: "gaming", sortOrder: 10 },
    { key: "shows", sortOrder: 30 },
    { key: "trading", sortOrder: 20 },
  ];
  assert.deepEqual(keys(sortTopicsByOrder(scrambled)), ["gaming", "trading", "shows", "crypto"]);
});

test("a topic inserted in the middle lands in the middle", () => {
  const withInsert = [
    { key: "gaming", sortOrder: 10 },
    { key: "trading", sortOrder: 20 },
    { key: "sports", sortOrder: 15 },
  ];
  assert.deepEqual(keys(sortTopicsByOrder(withInsert)), ["gaming", "sports", "trading"]);
});

test("ties keep the served order — the sort is stable, never a reshuffle", () => {
  const tied = [
    { key: "b", sortOrder: 10 },
    { key: "a", sortOrder: 10 },
    { key: "c", sortOrder: 10 },
  ];
  assert.deepEqual(keys(sortTopicsByOrder(tied)), ["b", "a", "c"]);
});

test("does not mutate the caller's array", () => {
  // The array belongs to the query cache; sorting it in place would reorder
  // every other reader of the same cached response.
  const original = [
    { key: "b", sortOrder: 20 },
    { key: "a", sortOrder: 10 },
  ];
  sortTopicsByOrder(original);
  assert.deepEqual(keys(original), ["b", "a"]);
});
