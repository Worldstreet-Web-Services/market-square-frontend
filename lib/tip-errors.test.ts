import assert from "node:assert/strict";
import { test } from "node:test";
import { TIP_ERROR_COPY, isTipRouteMissing } from "./tip-errors.ts";

test("a bare NOT_FOUND is the missing route, and quiets the control", () => {
  assert.equal(isTipRouteMissing("NOT_FOUND"), true);
});

test("a specific 404 is about the RECIPIENT and must not quiet the control", () => {
  // The distinction the whole graceful-absence behaviour rests on: one of
  // these hides the tip button on every post on screen, the other is a message
  // in one open sheet.
  for (const code of ["RECIPIENT_NOT_FOUND", "POST_NOT_FOUND", "PROFILE_NOT_FOUND"]) {
    assert.equal(isTipRouteMissing(code), false, code);
  }
});

test("no other failure is ever read as a missing route", () => {
  for (const code of [
    "SELF_TIP",
    "INSUFFICIENT_FUNDS",
    "PAYMENT_FAILED",
    "RATE_LIMITED",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "VALIDATION",
    "SERVICE_UNAVAILABLE",
  ]) {
    assert.equal(isTipRouteMissing(code), false, code);
  }
});

test("a throw that never reached the gateway is not a missing route", () => {
  // errorCode() answers null for a network drop or a bug of our own. Quieting
  // tipping across the app because the wifi blipped would be wrong.
  assert.equal(isTipRouteMissing(null), false);
});

test("every failure the flow can produce has copy, and it says where the money went", () => {
  for (const [code, copy] of Object.entries(TIP_ERROR_COPY)) {
    assert.ok(copy.length > 0, code);
    // A SCREAMING_SNAKE token is what a leaked error code looks like. Plain
    // uppercase words are fine — "KASH" is a currency, not a code.
    assert.doesNotMatch(copy, /[A-Z]{2,}_[A-Z]{2,}/, `${code}: raw codes never reach the screen`);
  }
  // The three that mean "your KASH is still yours" have to say so — a failure
  // that leaves the reader guessing whether they were charged is the one
  // outcome this flow must never produce.
  for (const code of ["INSUFFICIENT_FUNDS", "PAYMENT_FAILED"]) {
    assert.match(TIP_ERROR_COPY[code], /Nothing was sent/);
  }
});
