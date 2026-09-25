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
    assert.deepEqual(outcome, { kind: "already-linked", side: "unknown" });
    assert.equal(nextRetryMarker(outcome), "clear");
  });

  // The code is fixed by the contract; which side is taken is only in the
  // wording, and the person needs to be told which.
  it("says which side of the pairing is already taken", () => {
    const side = (message: string) =>
      classifyLinkResponse(409, { code: "LEGACY_ALREADY_LINKED", message });
    assert.deepEqual(side("this Privy account is linked to a different Decane account"), {
      kind: "already-linked",
      side: "legacy",
    });
    assert.deepEqual(side("this Decane account is already linked to a different Privy account"), {
      kind: "already-linked",
      side: "current",
    });
    assert.deepEqual(side("that wallet is linked to a different Decane account"), {
      kind: "already-linked",
      side: "wallet",
    });
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

  /*
    The BFF answers 502 when the migration service is unreachable or its 15s
    timeout fires. That used to read as "not available here", which cleared the
    pending-link marker and abandoned a link that was never recorded — the exact
    case the header says must not be swallowed.
  */
  it("retries a 502 from our own BFF, and keeps the marker", () => {
    const outcome = classifyLinkResponse(502, {
      code: "UPSTREAM_ERROR",
      message: "The account link service is unreachable.",
    });
    assert.deepEqual(outcome, { kind: "retry-later" });
    assert.equal(nextRetryMarker(outcome), "set");
  });

  /*
    §5 is explicit that a 503 matching neither message is permanent, so the
    502 above is narrow on purpose: it is OUR status, not the service's.
  */
  it("still treats a service 502 that is not ours as permanent", () => {
    assert.deepEqual(classifyLinkResponse(502, { code: "SERVER_ERROR" }), {
      kind: "unavailable",
    });
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
