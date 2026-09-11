import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatKash, kashAmount } from "./format.ts";

describe("KASH shows at most two decimal places", () => {
  it("drops decimals from a whole amount", () => {
    assert.equal(formatKash("80"), "80 KASH");
    assert.equal(formatKash("80.00000000"), "80 KASH");
  });

  it("shows two decimals when there are cents", () => {
    assert.equal(formatKash("80.5"), "80.50 KASH");
    assert.equal(formatKash("80.25"), "80.25 KASH");
  });

  it("cuts extra decimals instead of rounding a balance up", () => {
    assert.equal(kashAmount("80.259"), "80.25");
    assert.equal(kashAmount("80.999"), "80.99");
    assert.equal(kashAmount("0.009"), "0");
  });

  it("leaves a value that is not a number as it came", () => {
    assert.equal(formatKash("abc"), "abc KASH");
  });
});
