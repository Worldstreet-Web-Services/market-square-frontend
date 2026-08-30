import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KASH_DECIMALS,
  KASH_TOKEN_DECIMALS,
  compareKashAmounts,
  exceedsBalance,
  isKashAmount,
} from "./kash-amount.ts";

test("equal values compare equal however they are written", () => {
  // The trailing-zero case is the one a UI produces constantly: a preset "5"
  // against a server balance of "5.000000".
  assert.equal(compareKashAmounts("5", "5.00"), 0);
  assert.equal(compareKashAmounts("5.000000", "5"), 0);
  assert.equal(compareKashAmounts("0", "0.000000"), 0);
  assert.equal(compareKashAmounts("007", "7"), 0);
});

test("comparison is numeric, not lexicographic", () => {
  // "10" < "9" as text, and "5.9" > "5.10" as text. Both are wrong, and both
  // are what a naive string compare would tell a reader about their money.
  assert.equal(compareKashAmounts("10", "9"), 1);
  assert.equal(compareKashAmounts("9", "10"), -1);
  assert.equal(compareKashAmounts("5.10", "5.9"), -1);
});

test("precision is not lost at the engine's sixth decimal place", () => {
  // A float cannot separate these two; the engine stores them as distinct
  // micro-unit amounts, so we must be able to as well.
  assert.equal(compareKashAmounts("0.000001", "0.000002"), -1);
  assert.equal(compareKashAmounts("0.000002", "0.000001"), 1);
  assert.equal(compareKashAmounts("0.000001", "0.000001"), 0);
});

test("amounts far past a float's exact integer range still compare", () => {
  // 2^53 territory. Nothing here converts to a number, so this is exact
  // rather than approximately right.
  assert.equal(
    compareKashAmounts("9007199254740993", "9007199254740992"),
    1
  );
  assert.equal(
    compareKashAmounts("9007199254740993.000001", "9007199254740993"),
    1
  );
});

test("an unreadable side answers null, never a guess", () => {
  for (const bad of ["", " ", "abc", "-1", "1e3", "1,000", ".5", "1.2.3", "0x5"]) {
    assert.equal(compareKashAmounts(bad, "1"), null, bad);
    assert.equal(compareKashAmounts("1", bad), null, bad);
  }
});

test("more than six decimals is not a KASH amount", () => {
  // The engine's precision. Accepting a seventh place would mean sending an
  // amount that is silently truncated somewhere downstream.
  assert.equal(isKashAmount("1.123456"), true);
  assert.equal(isKashAmount("1.1234567"), false);
  assert.equal(compareKashAmounts("1.1234567", "1"), null);
});

test("zero is a number and not an amount", () => {
  for (const zero of ["0", "0.0", "0.000000", "00", "0."]) {
    assert.equal(isKashAmount(zero), false, zero);
  }
  assert.equal(isKashAmount("0.000001"), true);
});

test("a shortfall is only reported when both numbers are known", () => {
  assert.equal(exceedsBalance("10", "5"), true);
  assert.equal(exceedsBalance("5", "10"), false);
  // Exactly the balance is affordable — off-by-one here is somebody being
  // told they cannot spend what they have.
  assert.equal(exceedsBalance("10", "10"), false);
  assert.equal(exceedsBalance("10", "10.000000"), false);
});

test("an UNKNOWN balance never produces a shortfall warning", () => {
  // The load-bearing default: a balance that has not loaded, failed to load,
  // or came back malformed is not a zero balance. Warning on it would invent
  // a shortfall the service never claimed.
  for (const unknown of [null, undefined, "", "unknown", "NaN"]) {
    assert.equal(exceedsBalance("10", unknown), false, String(unknown));
  }
  for (const unknown of [null, undefined, ""]) {
    assert.equal(exceedsBalance(unknown, "10"), false, String(unknown));
  }
});

test("the API's precision and the TOKEN's are different numbers", () => {
  // Sending 5 KASH as 5e6 instead of 5e18 moves a trillionth of what the
  // sender agreed to — and the transfer succeeds. Two constants, two names.
  assert.equal(KASH_DECIMALS, 6);
  assert.equal(KASH_TOKEN_DECIMALS, 18);
  assert.notEqual(KASH_DECIMALS, KASH_TOKEN_DECIMALS);
});
