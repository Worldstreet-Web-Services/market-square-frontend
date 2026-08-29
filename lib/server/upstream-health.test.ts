import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  COOLDOWN_MS,
  FAILURE_THRESHOLD,
  MAX_COOLDOWN_MS,
  recordUpstreamFailure,
  recordUpstreamSuccess,
  resetUpstreamHealth,
  upstreamHealth,
  upstreamIsOpen,
  upstreamTimeoutMs,
} from "./upstream-health.ts";

const T = 2_000_000;

beforeEach(resetUpstreamHealth);

describe("upstreamTimeoutMs", () => {
  // 15s was the read ceiling. Nothing here reads for 15s, so that number never
  // saved a request — it only set how long a broken one stayed billed.
  it("fails a dead read fast, and leaves writes room", () => {
    assert.equal(upstreamTimeoutMs("GET", false), 5_000);
    assert.equal(upstreamTimeoutMs("HEAD", false), 5_000);
    assert.equal(upstreamTimeoutMs("POST", false), 15_000);
    assert.equal(upstreamTimeoutMs("DELETE", false), 15_000);
  });

  it("never shortens an upload, whatever the method", () => {
    assert.equal(upstreamTimeoutMs("POST", true), 120_000);
  });
});

describe("the instance breaker", () => {
  it("does not open on an ordinary failure", () => {
    recordUpstreamFailure(T);
    assert.equal(upstreamIsOpen(T), false);
  });

  it("opens once the upstream has failed consecutively", () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) recordUpstreamFailure(T);
    assert.equal(upstreamIsOpen(T), true);
    assert.equal(upstreamHealth().openUntil, T + COOLDOWN_MS);
    // Closed again once the cooldown passes, so recovery needs no signal.
    assert.equal(upstreamIsOpen(T + COOLDOWN_MS), false);
  });

  it("backs off while it stays down, to a ceiling", () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) recordUpstreamFailure(T);
    recordUpstreamFailure(T);
    assert.equal(upstreamHealth().openUntil - T, COOLDOWN_MS * 2);
    for (let i = 0; i < 10; i += 1) recordUpstreamFailure(T);
    assert.equal(upstreamHealth().openUntil - T, MAX_COOLDOWN_MS);
  });

  it("one success reopens the circuit", () => {
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) recordUpstreamFailure(T);
    recordUpstreamSuccess();
    assert.equal(upstreamIsOpen(T), false);
    assert.deepEqual(upstreamHealth(), { failures: 0, openUntil: 0 });
  });
});
