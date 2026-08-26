import assert from "node:assert/strict";
import { test } from "node:test";
import { excludeViewer } from "./people-directory.ts";

const rows = [{ id: "u_a" }, { id: "u_me" }, { id: "u_b" }];

test("the viewer is not someone they can discover", () => {
  assert.deepEqual(excludeViewer(rows, "u_me"), [{ id: "u_a" }, { id: "u_b" }]);
});

test("a signed-out reader has no row to remove", () => {
  // No viewer means nothing to exclude — and nothing to be confused by.
  assert.deepEqual(excludeViewer(rows, undefined), rows);
});

test("everyone else is left exactly as the server ordered them", () => {
  // Ordering is the server's (sort=followers); this only ever removes.
  assert.deepEqual(excludeViewer(rows, "u_absent"), rows);
  assert.deepEqual(excludeViewer([], "u_me"), []);
});

test("does not mutate the caller's array", () => {
  // The array belongs to the query cache; filtering in place would corrupt it
  // for every other reader of the same cached page.
  const original = [{ id: "u_me" }, { id: "u_a" }];
  excludeViewer(original, "u_me");
  assert.deepEqual(original, [{ id: "u_me" }, { id: "u_a" }]);
});
