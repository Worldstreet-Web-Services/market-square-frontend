/**
 * Why a getUserMedia capture failed, in the terms the UI has to answer in.
 *
 * These are NOT interchangeable, and collapsing them is a real bug: telling
 * someone whose camera is held by another tab to "allow camera access" points
 * them at a permission prompt that will never appear, because permission was
 * already granted. Each class has a different remedy:
 *
 *   denied         → the user must change a browser permission
 *   device-busy    → the user must close whatever else holds the device
 *   device-missing → the user must attach a device or relax the constraints
 *   failed         → we do not know; show the real error rather than guessing
 */
export type CaptureFailure = "denied" | "device-busy" | "device-missing" | "failed";

/**
 * The spec names, plus the vendor aliases still emitted in the wild.
 *
 * `TrackStartError` is Chrome's legacy spelling of `NotReadableError` and is
 * what actually arrives when a second browser profile on the same machine holds
 * the camera — the case this taxonomy was written for. `PermissionDeniedError`
 * and `DevicesNotFoundError` are the equivalent legacy spellings.
 */
const BY_NAME: Readonly<Record<string, CaptureFailure>> = {
  NotAllowedError: "denied",
  PermissionDeniedError: "denied",
  SecurityError: "denied",
  NotReadableError: "device-busy",
  TrackStartError: "device-busy",
  NotFoundError: "device-missing",
  DevicesNotFoundError: "device-missing",
  OverconstrainedError: "device-missing",
  ConstraintNotSatisfiedError: "device-missing",
};

/**
 * Classify a capture throw.
 *
 * `cause` is checked after the top-level name because LiveKit re-throws its own
 * error types from the track helpers and carries the original DOMException
 * underneath — the useful name is one level down, and reading only the surface
 * would classify every one of those as "failed".
 */
export function classifyCaptureError(error: unknown): CaptureFailure {
  const direct = (error as { name?: unknown } | null)?.name;
  if (typeof direct === "string" && BY_NAME[direct]) return BY_NAME[direct];

  const nested = (error as { cause?: { name?: unknown } } | null)?.cause?.name;
  if (typeof nested === "string" && BY_NAME[nested]) return BY_NAME[nested];

  return "failed";
}

/** The underlying message, or a usable fallback — never an empty string. */
export function captureErrorMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim().length > 0
    ? message
    : "Something went wrong connecting you to the stage.";
}
