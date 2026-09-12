import assert from "node:assert/strict";
import { test } from "node:test";
import { apiError, errorMessage } from "./envelope.ts";

/**
 * REGRESSION: one broken capability announced itself as a total outage.
 *
 * The service uses `SERVICE_UNAVAILABLE` for a single unconfigured dependency
 * as well as for being down. Going live returned it with the message "LiveKit
 * room creation failed" — and this function threw that away and answered
 * "Market Square is unreachable right now." So every creator who tried to
 * stream was told the product was down, while the feed, messages and search
 * were all answering in under a second.
 */
test("a specific upstream message survives instead of becoming an outage claim", () => {
  const error = apiError("SERVICE_UNAVAILABLE", "LiveKit room creation failed", 502);
  assert.equal(errorMessage(error, "fallback"), "LiveKit room creation failed");
});

test("a real outage still reads as one", () => {
  // What our own proxy raises when it genuinely cannot reach the upstream.
  const error = apiError("SERVICE_UNAVAILABLE", "Market Square is unreachable.", 502);
  assert.equal(errorMessage(error, "fallback"), "Market Square is unreachable.");
});

test("with no message at all, the generic line is still there", () => {
  const error = apiError("SERVICE_UNAVAILABLE", "", 503);
  assert.equal(errorMessage(error, "fallback"), "Square is unreachable right now.");
});

test("the codes a reader can act on keep their own copy", () => {
  // These are OUR words on purpose — the upstream's phrasing for an expired
  // session or a missing row is written for a developer.
  for (const [code, expected] of [
    ["UNAUTHORIZED", "Sign in to continue."],
    ["SESSION_EXPIRED", "Session expired — sign in again."],
    ["FORBIDDEN", "You don't have access to that."],
    ["NOT_FOUND", "That wasn't found — it may have been removed."],
    ["RATE_LIMITED", "Slow down — try again in a moment."],
  ] as const) {
    assert.equal(errorMessage(apiError(code, "raw upstream text", 400), "fallback"), expected, code);
  }
});
