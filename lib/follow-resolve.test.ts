import assert from "node:assert/strict";
import { test } from "node:test";
import { intentIsSettled, resolveFollowState } from "./follow-resolve.ts";

test("the server wins whenever it carries the field", () => {
  assert.equal(resolveFollowState(true, undefined), true);
  assert.equal(resolveFollowState(false, undefined), false);
  // Even against a stale intent — the reconcile is the server's, not ours.
  assert.equal(resolveFollowState(false, true), false);
  assert.equal(resolveFollowState(true, false), true);
});

test("an optimistic follow survives a payload that omits the field", () => {
  // This is the Citizen Spotlight bug: /spotlight does not return
  // isFollowing, so the refetch used to stamp Follow back over the click.
  assert.equal(resolveFollowState(undefined, true), true);
  assert.equal(resolveFollowState(undefined, false), false);
});

test("no server field and no intent never fabricates Following", () => {
  assert.equal(resolveFollowState(undefined, undefined), false);
});

test("an intent is settled only once the server has an opinion", () => {
  assert.equal(intentIsSettled(undefined), false);
  assert.equal(intentIsSettled(true), true);
  assert.equal(intentIsSettled(false), true);
});
