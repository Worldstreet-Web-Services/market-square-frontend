import assert from "node:assert/strict";
import { test } from "node:test";
import { QuoteError, normaliseQuote } from "./buy-quote.ts";

const OK = {
  depositRequestId: "req_123",
  depositAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amountOut: "38402",
  expiresInSeconds: 600,
};

test("a complete quote parses into the instruction to pay", () => {
  assert.deepEqual(normaliseQuote(OK, 8), {
    estimatedOutput: 38402n,
    depositAddress: OK.depositAddress,
    requestId: "req_123",
    expiresInSeconds: 600,
  });
});

test("NO deposit address means no quote — this is a transfer into nowhere", () => {
  for (const bad of [undefined, null, "", "   ", 42]) {
    assert.throws(
      () => normaliseQuote({ ...OK, depositAddress: bad }, 8),
      QuoteError,
      String(bad)
    );
  }
});

test("no order id means no quote — the money would be untrackable", () => {
  // Without it there is no way back to the order once it is paid for.
  for (const bad of [undefined, null, "", "  ", 42]) {
    assert.throws(
      () => normaliseQuote({ ...OK, depositRequestId: bad }, 8),
      QuoteError,
      String(bad)
    );
  }
});

test("an output reported as a human decimal is scaled, not truncated", () => {
  // The 10^8 mistake: "0.00038402" read as base units would preview a wildly
  // different number, and the preview is the only thing a reader can check
  // the order against.
  assert.equal(normaliseQuote({ ...OK, amountOut: "0.00038402" }, 8).estimatedOutput, 38402n);
  assert.equal(normaliseQuote({ ...OK, amountOut: "38402" }, 8).estimatedOutput, 38402n);
});

test("a cosmetic field degrades rather than refusing a payable order", () => {
  // The preview and the expiry are nice to have; neither is the payment.
  assert.equal(normaliseQuote({ ...OK, amountOut: undefined }, 8).estimatedOutput, 0n);
  assert.equal(normaliseQuote({ ...OK, amountOut: "junk" }, 8).estimatedOutput, 0n);
  assert.equal(normaliseQuote({ ...OK, expiresInSeconds: "soon" }, 8).expiresInSeconds, 0);
  assert.equal(normaliseQuote({ ...OK, expiresInSeconds: Number.NaN }, 8).expiresInSeconds, 0);
});
