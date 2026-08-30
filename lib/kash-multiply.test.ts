import assert from "node:assert/strict";
import { test } from "node:test";
import { multiplyKash } from "./kash-amount.ts";

test("multiplies without float drift", () => {
  // The whole reason this exists: Number("0.01") * 3 is 0.030000000000000002.
  assert.equal(multiplyKash("0.01", 3), "0.03");
  assert.equal(multiplyKash("0.1", 3), "0.3");
  assert.equal(multiplyKash("0.07", 3), "0.21");
});

test("keeps whole amounts whole", () => {
  assert.equal(multiplyKash("1", 5), "5");
  assert.equal(multiplyKash("2.5", 4), "10");
});

test("a single gift costs exactly its price", () => {
  for (const price of ["0.01", "0.02", "0.05", "0.1", "0.15", "1", "10"]) {
    assert.equal(multiplyKash(price, 1), price);
  }
});

test("refuses a count that is not a positive whole number", () => {
  assert.equal(multiplyKash("0.01", 0), null);
  assert.equal(multiplyKash("0.01", -2), null);
  assert.equal(multiplyKash("0.01", 1.5), null);
  assert.equal(multiplyKash("0.01", Number.NaN), null);
});

test("refuses an amount that is not KASH", () => {
  assert.equal(multiplyKash("", 2), null);
  assert.equal(multiplyKash("1e3", 2), null);
  assert.equal(multiplyKash("1,000", 2), null);
  assert.equal(multiplyKash("-1", 2), null);
  // Seven places: the engine would truncate it, so it is not an amount.
  assert.equal(multiplyKash("0.0000001", 2), null);
});

test("refuses a product that would exceed six places", () => {
  // 0.000001 is payable; a third of it is not, and rounding would charge a
  // number nobody agreed to.
  assert.equal(multiplyKash("0.000001", 1), "0.000001");
  assert.equal(multiplyKash("0.000001", 1000), "0.001");
});

test("zero is a number, not an amount", () => {
  assert.equal(multiplyKash("0", 5), null);
  assert.equal(multiplyKash("0.000000", 5), null);
});
