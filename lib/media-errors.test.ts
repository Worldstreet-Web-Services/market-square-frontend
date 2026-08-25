import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captureErrorMessage, classifyCaptureError } from "./media-errors.ts";

/** A DOMException as the browser throws it: the useful part is `name`. */
function domError(name: string, message = "capture failed") {
  return Object.assign(new Error(message), { name });
}

describe("classifyCaptureError", () => {
  it("separates a real permission refusal from every other failure", () => {
    assert.equal(classifyCaptureError(domError("NotAllowedError")), "denied");
    assert.equal(classifyCaptureError(domError("PermissionDeniedError")), "denied");
    assert.equal(classifyCaptureError(domError("SecurityError")), "denied");
  });

  it("reads a device held by another app or tab as busy, not denied", () => {
    // The reported bug: host and guest in two browser profiles on one laptop.
    // Chrome throws TrackStartError here, Firefox NotReadableError. Neither is
    // a permission problem, and neither is fixed by a permission prompt.
    assert.equal(classifyCaptureError(domError("NotReadableError")), "device-busy");
    assert.equal(classifyCaptureError(domError("TrackStartError")), "device-busy");
  });

  it("reads an absent or unmatchable device as missing", () => {
    assert.equal(classifyCaptureError(domError("NotFoundError")), "device-missing");
    assert.equal(classifyCaptureError(domError("DevicesNotFoundError")), "device-missing");
    assert.equal(classifyCaptureError(domError("OverconstrainedError")), "device-missing");
    assert.equal(
      classifyCaptureError(domError("ConstraintNotSatisfiedError")),
      "device-missing"
    );
  });

  it("unwraps a cause, because LiveKit re-throws over the DOMException", () => {
    const wrapped = Object.assign(new Error("could not create track"), {
      name: "TrackInvalidError",
      cause: domError("NotReadableError"),
    });
    assert.equal(classifyCaptureError(wrapped), "device-busy");
  });

  it("prefers the top-level name over the cause when both are known", () => {
    const wrapped = Object.assign(new Error("nope"), {
      name: "NotAllowedError",
      cause: domError("NotReadableError"),
    });
    assert.equal(classifyCaptureError(wrapped), "denied");
  });

  it("never guesses: an unknown throw stays 'failed'", () => {
    assert.equal(classifyCaptureError(domError("SomeFutureError")), "failed");
    assert.equal(classifyCaptureError(new Error("plain")), "failed");
    assert.equal(classifyCaptureError(null), "failed");
    assert.equal(classifyCaptureError(undefined), "failed");
    assert.equal(classifyCaptureError("a string"), "failed");
    assert.equal(classifyCaptureError({ name: 42 }), "failed");
  });
});

describe("captureErrorMessage", () => {
  it("passes a real message through", () => {
    assert.equal(captureErrorMessage(new Error("ICE failed")), "ICE failed");
  });

  it("falls back rather than rendering an empty string", () => {
    for (const value of [new Error(""), new Error("   "), null, undefined, {}]) {
      assert.match(captureErrorMessage(value), /Something went wrong/);
    }
  });
});
