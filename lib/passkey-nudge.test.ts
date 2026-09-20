import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nudgeDue } from "./passkey-nudge.ts";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe("when to re-offer a passkey", () => {
  it("offers a device that has never declined", () => {
    assert.equal(nudgeDue(null, NOW), true);
  });

  /*
    The reason a device is on a PIN usually changes — a password manager that
    was not signed in at wallet-creation time later is. So "no" is an answer
    for a while, not forever.
  */
  it("takes no for an answer, for a week", () => {
    assert.equal(nudgeDue(String(NOW - 1000), NOW), false);
    assert.equal(nudgeDue(String(NOW - WEEK + 1000), NOW), false);
    assert.equal(nudgeDue(String(NOW - WEEK - 1000), NOW), true);
  });

  /*
    A useless record must not suppress the offer forever. Erring toward asking
    again costs a dismissal; erring the other way costs a device that never
    gets a passkey at all.
  */
  it("treats an unreadable record as no record", () => {
    assert.equal(nudgeDue("not a number", NOW), true);
    assert.equal(nudgeDue("", NOW), true);
  });
});
