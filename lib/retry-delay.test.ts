import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retryDelay } from "./retry-delay.ts";

describe("retryDelay", () => {
  // The delays were exactly 1s, 2s, 4s — so every client that failed at the
  // same moment retried at the same moment. That synchronised wave is what
  // hits a recovering backend and knocks it over again.
  it("never returns the same delay for the same attempt", () => {
    const delays = new Set(Array.from({ length: 50 }, () => retryDelay(0)));
    assert.ok(delays.size > 10, "a deterministic delay is a synchronised retry");
  });

  it("still backs off, and stays inside half..full of the base", () => {
    for (const [attempt, base] of [
      [0, 1000],
      [1, 2000],
      [2, 4000],
      [3, 8000],
    ] as const) {
      assert.equal(retryDelay(attempt, () => 0), base / 2, `attempt ${attempt} floor`);
      assert.equal(retryDelay(attempt, () => 1), base, `attempt ${attempt} ceiling`);
    }
  });

  it("is capped, so a long outage cannot produce a minute-long wait", () => {
    assert.equal(retryDelay(20, () => 1), 8000);
  });
});
