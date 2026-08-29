import assert from "node:assert/strict";
import { test } from "node:test";
import { isSettledOutcome, receiptOutcome } from "./tx-receipt.ts";

test("no receipt yet is pending — a hash is not a payment", () => {
  assert.equal(receiptOutcome(null), "pending");
  assert.equal(receiptOutcome(undefined), "pending");
});

test("0x1 succeeded, 0x0 REVERTED", () => {
  // A reverted transaction has a receipt, a block number and a gas cost, and
  // moves nothing. Reading it as success would ask the engine to verify a
  // payment that never happened.
  assert.equal(receiptOutcome({ status: "0x1", blockNumber: "0x12" }), "succeeded");
  assert.equal(receiptOutcome({ status: "0x0", blockNumber: "0x12" }), "reverted");
});

test("the quantity encodings providers actually send all resolve", () => {
  for (const status of ["0x1", "0x01", "1", "0X1"]) {
    assert.equal(receiptOutcome({ status }), "succeeded", String(status));
  }
  for (const status of ["0x0", "0x00", "0"]) {
    assert.equal(receiptOutcome({ status }), "reverted", String(status));
  }
  assert.equal(receiptOutcome({ status: 1 }), "succeeded");
  assert.equal(receiptOutcome({ status: 0 }), "reverted");
});

test("a receipt with no status is PENDING, never success", () => {
  // "I do not know whether this payment succeeded" has exactly one safe
  // reading, and it is to keep waiting.
  assert.equal(receiptOutcome({ blockNumber: "0x12" }), "pending");
  assert.equal(receiptOutcome({ status: null }), "pending");
  assert.equal(receiptOutcome({ status: "0x2" }), "pending");
  assert.equal(receiptOutcome({ status: {} }), "pending");
  assert.equal(receiptOutcome("not a receipt" as unknown as null), "pending");
});

test("only pending is worth asking about again", () => {
  assert.equal(isSettledOutcome("pending"), false);
  assert.equal(isSettledOutcome("succeeded"), true);
  assert.equal(isSettledOutcome("reverted"), true);
});
