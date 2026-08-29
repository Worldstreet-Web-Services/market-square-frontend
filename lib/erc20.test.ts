import assert from "node:assert/strict";
import { test } from "node:test";
import {
  encodeErc20Transfer,
  formatUsdc,
  fromBaseUnits,
  isPayableAmount,
  toBaseUnits,
  usdcToBaseUnits,
} from "./erc20.ts";

const RECIPIENT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

test("the calldata matches the canonical ABI encoding, byte for byte", () => {
  // The known vector: selector, then the address right-aligned in 32 bytes,
  // then the amount right-aligned in 32 bytes. This is what a library would
  // produce for the same call, and pinning it is what lets this module stay
  // dependency-free without taking anything on trust.
  assert.equal(
    encodeErc20Transfer(RECIPIENT, 10_000_000n),
    "0xa9059cbb" +
      "000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913" +
      "0000000000000000000000000000000000000000000000000000000000989680"
  );
});

test("a zero amount encodes as a full word of zeros, not as nothing", () => {
  const data = encodeErc20Transfer(RECIPIENT, 0n);
  assert.equal(data.length, 2 + 8 + 64 + 64);
});

test("a malformed recipient throws rather than being padded into the slot", () => {
  // The irreversible failure this guard exists for: a well-formed transaction
  // that sends real money to an address nobody controls.
  for (const bad of ["", "0x", "not-an-address", RECIPIENT.slice(0, -1), `${RECIPIENT}0`]) {
    assert.throws(() => encodeErc20Transfer(bad, 1n), /not an EVM address/u, bad);
  }
});

test("a negative amount throws instead of wrapping into a huge uint256", () => {
  assert.throws(() => encodeErc20Transfer(RECIPIENT, -1n), /negative/u);
});

test("decimal to base units is exact where a float is not", () => {
  // parseFloat("0.1") * 1e6 is 100000.00000000001. This is not.
  assert.equal(usdcToBaseUnits("0.1"), 100_000n);
  assert.equal(usdcToBaseUnits("10"), 10_000_000n);
  assert.equal(usdcToBaseUnits("10.000000"), 10_000_000n);
  assert.equal(usdcToBaseUnits("0.000001"), 1n);
  assert.equal(usdcToBaseUnits("0"), 0n);
});

test("amounts past a float's exact integer range survive", () => {
  assert.equal(toBaseUnits("9007199254740993", 6), 9_007_199_254_740_993_000_000n);
});

test("more precision than the token holds THROWS, and is never rounded away", () => {
  // Rounding here would silently change the sum, in a direction the person
  // authorising the payment never agreed to.
  assert.throws(() => usdcToBaseUnits("0.0000001"), /at most 6 decimals/u);
  assert.throws(() => usdcToBaseUnits("1.1234567"), /at most 6 decimals/u);
});

test("anything that is not a plain decimal throws", () => {
  for (const bad of ["", " ", "-1", "1e6", "1,000", ".5", "abc", "0x10", "1.2.3"]) {
    assert.throws(() => usdcToBaseUnits(bad), /not a decimal amount/u, bad);
  }
});

test("base units round-trip back to the same decimal string", () => {
  for (const amount of ["10", "0.1", "0.000001", "1234.56", "0"]) {
    assert.equal(fromBaseUnits(usdcToBaseUnits(amount), 6), String(Number(amount)));
  }
  // Trailing zeros are dropped, not significant.
  assert.equal(fromBaseUnits(10_000_000n, 6), "10");
  assert.equal(fromBaseUnits(1n, 6), "0.000001");
});

test("a displayed dollar figure rounds DOWN, so it never overstates what is spendable", () => {
  // $4.999 shown as $5.00 invites somebody to spend five dollars they do not
  // have and land on a revert.
  assert.equal(formatUsdc(4_999_000n), "4.99");
  assert.equal(formatUsdc(4_999_999n), "4.99");
  assert.equal(formatUsdc(5_000_000n), "5.00");
  assert.equal(formatUsdc(0n), "0.00");
  assert.equal(formatUsdc(1n), "0.00");
});

test("zero is not a payable amount", () => {
  // A zero-value transfer is a real transaction that costs real gas and buys
  // nothing.
  for (const zero of ["0", "0.0", "0.000000", "00"]) {
    assert.equal(isPayableAmount(zero), false, zero);
  }
  assert.equal(isPayableAmount("0.000001"), true);
  assert.equal(isPayableAmount("10"), true);
});

test("isPayableAmount answers rather than throwing, for a disabled button", () => {
  for (const bad of ["", "abc", "-1", "1.1234567", "1e6"]) {
    assert.equal(isPayableAmount(bad), false, bad);
  }
});
