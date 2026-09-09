import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptLabel, receiptState } from "../features/messages/lib/read-receipt.ts";

test("a receipt only ever appears under the viewer's OWN message", () => {
  // The design draws the double-check on every bubble, the peer's included.
  // That is a duplicated component in the file, not an instruction: telling
  // somebody they have read a message they are looking at is not information.
  assert.equal(receiptState({ mine: false, group: false, readByAll: true }), "none");
  assert.equal(receiptState({ mine: false, group: true, readBy: 40 }), "none");
});

test("a removed message carries no receipt", () => {
  // The body is gone; whether it was read before it went is not a claim the
  // surface should still be making.
  assert.equal(
    receiptState({ mine: true, group: false, status: "removed", readByAll: true }),
    "none"
  );
});

test("a 1:1 has two states, because there is exactly one other reader", () => {
  assert.equal(receiptState({ mine: true, group: false }), "sent");
  assert.equal(receiptState({ mine: true, group: false, readByAll: true }), "read");
  // A service that ships the count before the boolean must still be able to
  // show a read message as read — "Read by 1" in a two-person thread would be
  // an absurd way to say "Read".
  assert.equal(receiptState({ mine: true, group: false, readBy: 1 }), "read");
});

test("a group has three, and the middle one is the useful one", () => {
  assert.equal(receiptState({ mine: true, group: true }), "sent");
  assert.equal(receiptState({ mine: true, group: true, readBy: 3 }), "partial");
  assert.equal(receiptState({ mine: true, group: true, readBy: 74, readByAll: true }), "read");
  // readByAll outranks the count: the service's own answer to "everyone" is
  // the only one a client can trust without also knowing the roster size at
  // the moment of sending.
  assert.equal(receiptState({ mine: true, group: true, readBy: 0, readByAll: true }), "read");
});

test("every receipt says something out loud, because the glyph says nothing", () => {
  assert.equal(receiptLabel("none"), "");
  // "Sent" is the honest ceiling for an unread message — the contract has no
  // delivery signal, so nothing here may claim one.
  assert.equal(receiptLabel("sent"), "Sent");
  assert.equal(receiptLabel("read"), "Read");
  assert.equal(receiptLabel("partial", 3), "Read by 3");
  // The count is the whole point of `partial`, so it never degrades to zero.
  assert.equal(receiptLabel("partial", 0), "Read by 1");
  assert.equal(receiptLabel("partial", 2.7), "Read by 2");
});
