import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * The rule `endStream` follows, pinned here because the module itself reaches
 * for the network and cannot be imported without it.
 *
 * It is the shape that matters: a POST that fails is not the same as a room
 * that is still live, and on 2026-09-21 every close in production answered 500
 * while the room came back `ended`.
 */
function settledEnd(
  postFailed: boolean,
  status: string | null
): "success" | "rethrow" {
  if (!postFailed) return "success";
  if (status === "ended" || status === "cancelled") return "success";
  return "rethrow";
}

describe("A room that is over is a success, whatever the POST said", () => {
  it("is a success when the request worked", () => {
    assert.equal(settledEnd(false, "live"), "success");
  });

  it("is a success when the request failed but the room is over", () => {
    // The production case: 500 INTERNAL_ERROR, `endedAt` already set. Telling
    // the host it failed made them press it again on a closed room.
    assert.equal(settledEnd(true, "ended"), "success");
    assert.equal(settledEnd(true, "cancelled"), "success");
  });

  it("rethrows when the room is genuinely still live", () => {
    // Or this becomes a way to swallow real failures.
    assert.equal(settledEnd(true, "live"), "rethrow");
    assert.equal(settledEnd(true, "scheduled"), "rethrow");
  });

  it("rethrows when the check itself could not answer", () => {
    assert.equal(settledEnd(true, null), "rethrow");
  });
});
