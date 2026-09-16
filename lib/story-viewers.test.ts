import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { seenByLabel, shouldRetryViewers } from "./story-viewers.ts";

describe("the Seen by label", () => {
  it("counts from the story's total", () => {
    assert.equal(seenByLabel(1), "Seen by 1");
    assert.equal(seenByLabel(12), "Seen by 12");
    assert.equal(seenByLabel(1234), "Seen by 1,234");
  });

  it("says so plainly when nobody has looked yet", () => {
    assert.equal(seenByLabel(0), "No views yet");
    assert.equal(seenByLabel(-3), "No views yet");
    assert.equal(seenByLabel(Number.NaN), "No views yet");
  });
});

describe("retrying the viewers read", () => {
  it("never retries a 4xx — not the author, not a story, or not deployed", () => {
    for (const status of [400, 401, 403, 404]) {
      assert.equal(shouldRetryViewers(0, { status }), false, String(status));
    }
  });

  it("retries a blip twice, then stops", () => {
    assert.equal(shouldRetryViewers(0, { status: 503 }), true);
    assert.equal(shouldRetryViewers(1, new TypeError("fetch failed")), true);
    assert.equal(shouldRetryViewers(2, { status: 503 }), false);
  });
});
