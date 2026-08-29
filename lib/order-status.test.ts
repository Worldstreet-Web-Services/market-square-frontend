import assert from "node:assert/strict";
import { test } from "node:test";
import { TERMINAL_STAGES, isSettled, orderProgress } from "./order-status.ts";

test("the furthest-along of the two provider strings wins", () => {
  // Neither field alone is complete: one can still say PENDING while the
  // other has already said the order settled.
  assert.equal(orderProgress("PENDING", "SUCCESS").stage, "settled");
  assert.equal(orderProgress("SUCCESS", "PENDING").stage, "settled");
  assert.equal(orderProgress("PENDING", "PROCESSING").stage, "processing");
});

test("an unknown vocabulary degrades to waiting, never to settled", () => {
  // Reading a status nobody has checked as "settled" tells somebody their
  // money arrived on the word of a string we have never seen.
  assert.equal(orderProgress("QUANTUM_FLUX").stage, "waiting");
  assert.equal(orderProgress("", "").stage, "waiting");
  assert.equal(orderProgress("PENDING").stage, "waiting");
  assert.equal(orderProgress("PENDING").terminal, false);
});

test("a failed refund is a FAILURE, not a refund", () => {
  // The ordering that makes this work: the failure vocabulary is tested
  // before the refund and success ones, so a compound status cannot be read
  // as the good half of itself.
  assert.equal(orderProgress("REFUND_FAILED").stage, "failed");
  assert.equal(orderProgress("SETTLEMENT_ERROR").stage, "failed");
  assert.equal(orderProgress("EXPIRED").stage, "failed");
});

test("a plain refund reads as refunded", () => {
  assert.equal(orderProgress("REFUNDED").stage, "refunded");
  assert.equal(orderProgress("PENDING", "refund_completed").stage, "refunded");
});

test("each stage has copy free of bridging jargon", () => {
  for (const [status, expected] of [
    ["PENDING", "waiting"],
    ["DEPOSIT_DETECTED", "detected"],
    ["BRIDGING", "processing"],
    ["SUCCESS", "settled"],
  ] as const) {
    const progress = orderProgress(status);
    assert.equal(progress.stage, expected, status);
    assert.ok(progress.label.length > 0, status);
    assert.ok(!/bridg|settl|relay/iu.test(progress.label), progress.label);
  }
});

test("progress only ever moves forward across the stages", () => {
  const order = ["waiting", "detected", "processing", "settled"] as const;
  const percentages = order.map((stage) => orderProgress(stage === "waiting" ? "PENDING" : stage).pct);
  for (let i = 1; i < percentages.length; i += 1) {
    assert.ok(percentages[i] > percentages[i - 1], order[i]);
  }
});

test("exactly the three end states are terminal, and only one is a purchase", () => {
  // Polling stops on all three; only `settled` means the reader got what they
  // paid for, and the receipt must not treat a refund as a success.
  assert.deepEqual([...TERMINAL_STAGES].sort(), ["failed", "refunded", "settled"]);
  assert.equal(isSettled("settled"), true);
  assert.equal(isSettled("refunded"), false);
  assert.equal(isSettled("failed"), false);
  for (const status of ["SUCCESS", "REFUNDED", "FAILED"]) {
    assert.equal(orderProgress(status).terminal, true, status);
  }
});
