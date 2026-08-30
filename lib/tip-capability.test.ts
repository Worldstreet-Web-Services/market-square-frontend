import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canSendTip,
  tipAmountOutOfBounds,
  tipBlockedBecause,
  tipBoundsMessage,
} from "./tip-capability.ts";

/** What production actually publishes today. */
const LIVE = {
  enabled: true,
  settlement: "client-signed" as const,
  minKash: "1",
  maxKash: "10000",
  verifiedAuthorsOnly: true,
};
const verified = { verification: "verified" };

test("the amounts the sheet shipped with are BELOW the server's minimum", () => {
  // The bug: the sheet defaulted to 0.05 KASH and the gift tray's eight
  // cheapest tiles all sit under a whole KASH, while the service refuses
  // anything under 1. Tapping the rose and sending was rejected every time.
  for (const amount of ["0.01", "0.02", "0.05", "0.1", "0.15", "0.2", "0.25", "0.5"]) {
    assert.equal(tipAmountOutOfBounds(amount, LIVE), "below-min", amount);
    assert.equal(canSendTip(amount, LIVE, verified), false, amount);
  }
});

test("the amounts at or above the minimum are accepted", () => {
  for (const amount of ["1", "1.00", "2", "5", "10", "10000"]) {
    assert.equal(tipAmountOutOfBounds(amount, LIVE), null, amount);
    assert.equal(canSendTip(amount, LIVE, verified), true, amount);
  }
});

test("the ceiling is enforced too, and named", () => {
  assert.equal(tipAmountOutOfBounds("10001", LIVE), "above-max");
  assert.equal(tipBoundsMessage("above-max", LIVE), "The largest tip is 10000 KASH.");
  assert.equal(tipBoundsMessage("below-min", LIVE), "The smallest tip is 1 KASH.");
});

test("bounds are compared as decimals, never as floats or text", () => {
  // "0.9" > "1" lexicographically, and 0.1+0.2 is not 0.3 as a float.
  assert.equal(tipAmountOutOfBounds("0.9", LIVE), "below-min");
  assert.equal(tipAmountOutOfBounds("9", { ...LIVE, maxKash: "10" }), null);
  assert.equal(tipAmountOutOfBounds("2", { ...LIVE, minKash: "10" }), "below-min");
});

test("only a VERIFIED recipient may be tipped while the server says so", () => {
  assert.equal(tipBlockedBecause(LIVE, verified), null);
  // `lapsed` is a verified account whose payment ran out. It must never be
  // treated as verified — least of all where money is about to move.
  for (const state of ["none", "pending", "lapsed", undefined, null]) {
    assert.equal(tipBlockedBecause(LIVE, { verification: state }), "unverified-recipient", String(state));
  }
  assert.equal(tipBlockedBecause(LIVE, null), "unverified-recipient");
});

test("with the rule off, anybody may be tipped", () => {
  const open = { ...LIVE, verifiedAuthorsOnly: false };
  assert.equal(tipBlockedBecause(open, { verification: "none" }), null);
  assert.equal(tipBlockedBecause(open, null), null);
});

test("tipping switched off blocks everyone, verified or not", () => {
  assert.equal(tipBlockedBecause({ ...LIVE, enabled: false }, verified), "disabled");
});

test("an ABSENT capability is permissive, so a slow lookup never breaks tipping", () => {
  // The read can fail or still be in flight. Hiding every tip control because
  // a lookup has not come back would break the feature to fix a message; the
  // service refuses what it must.
  assert.equal(tipBlockedBecause(null, null), null);
  assert.equal(tipBlockedBecause(undefined, { verification: "none" }), null);
  assert.equal(tipAmountOutOfBounds("0.01", null), null);
  assert.equal(canSendTip("0.01", null, null), true);
});

test("an unparseable bound is ignored rather than forbidding everything", () => {
  assert.equal(tipAmountOutOfBounds("5", { ...LIVE, minKash: "abc" }), null);
  assert.equal(tipAmountOutOfBounds("abc", LIVE), null);
});
