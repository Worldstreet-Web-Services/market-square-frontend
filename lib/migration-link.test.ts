import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyLinkResponse,
  nextRetryMarker,
  readSquareRekey,
  squareSettled,
} from "./migration-link.ts";

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

describe("reading rekey.square — what happened to the PROFILE", () => {
  const body = (square: unknown) => ({ success: true, data: { rekey: { square } } });

  it("reads each status Square can report", () => {
    assert.equal(readSquareRekey(body("done")), "done");
    assert.equal(readSquareRekey(body("none")), "none");
    assert.equal(readSquareRekey(body("pending")), "pending");
    assert.equal(readSquareRekey(body("failed")), "failed");
  });

  /*
    The field is `square`. The name this code guarded against for months was
    `market-square`, which the service has never emitted.
  */
  it("does not answer to market-square", () => {
    assert.equal(readSquareRekey({ data: { rekey: { "market-square": "done" } } }), "unknown");
  });

  /*
    Absence is not pending. An older service, or a 409 SAME_WALLET that carries
    no rekey map, must not park the reader on a spinner waiting for an answer
    that is never coming.
  */
  it("reads an absent or unrecognised value as unknown, which is settled", () => {
    assert.equal(readSquareRekey(body(undefined)), "unknown");
    assert.equal(readSquareRekey(body("something-new")), "unknown");
    assert.equal(readSquareRekey({ success: true }), "unknown");
    assert.equal(readSquareRekey(null), "unknown");
    assert.equal(readSquareRekey("not json"), "unknown");
    assert.equal(squareSettled("unknown"), true);
  });

  it("waits on pending and nothing else", () => {
    assert.equal(squareSettled("pending"), false);
    for (const settled of ["done", "none", "failed", "unknown"] as const) {
      assert.equal(squareSettled(settled), true);
    }
  });
});
