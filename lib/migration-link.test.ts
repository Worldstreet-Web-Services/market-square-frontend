import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyLinkResponse, nextRetryMarker } from "./migration-link.ts";

describe("reading a link response (llms-link.txt §5)", () => {
  it("treats a 200 as the pairing recorded", () => {
    assert.deepEqual(classifyLinkResponse(200, null), { kind: "linked" });
  });

  it("treats SAME_WALLET as a no-op, not a failure", () => {
    assert.deepEqual(classifyLinkResponse(409, { code: "SAME_WALLET" }), { kind: "linked" });
  });

  it("stops on LEGACY_ALREADY_LINKED and never asks for a retry", () => {
    const outcome = classifyLinkResponse(409, { code: "LEGACY_ALREADY_LINKED" });
    assert.deepEqual(outcome, { kind: "already-linked" });
    assert.equal(nextRetryMarker(outcome), "clear");
  });

  it("asks for a fresh sign-in on a 401", () => {
    assert.deepEqual(classifyLinkResponse(401, { code: "UNAUTHORIZED" }), { kind: "reauth" });
  });

  it("retries the transient 503 later — the one that must NOT be swallowed", () => {
    const outcome = classifyLinkResponse(503, {
      code: "SERVICE_UNAVAILABLE",
      message: "Identity service unreachable, retry shortly",
    });
    assert.deepEqual(outcome, { kind: "retry-later" });
    assert.equal(nextRetryMarker(outcome), "set");
  });

  it("swallows the permanent AUTH_PROVIDERS 503", () => {
    const outcome = classifyLinkResponse(503, {
      code: "SERVICE_UNAVAILABLE",
      message: "Migration requires AUTH_PROVIDERS to include decane",
    });
    assert.deepEqual(outcome, { kind: "unavailable" });
    assert.equal(nextRetryMarker(outcome), "clear");
  });

  it("treats a 503 matching neither message as permanent", () => {
    assert.deepEqual(classifyLinkResponse(503, { code: "SERVICE_UNAVAILABLE", message: "down" }), {
      kind: "unavailable",
    });
    assert.deepEqual(classifyLinkResponse(503, { code: "NOT_CONFIGURED" }), { kind: "unavailable" });
  });

  it("never reads rekey at all — Square is not in it", () => {
    assert.deepEqual(classifyLinkResponse(200, undefined), { kind: "linked" });
  });
});
