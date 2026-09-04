"use client";

// Every Market Square endpoint answers with { success, data | error }. This
// unwraps that envelope into a value or a typed error so all features fail the
// same way.

export interface GatewayApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): GatewayApiError {
  const error = new Error(message) as GatewayApiError;
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function parseBody(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function fallbackCode(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVICE_UNAVAILABLE";
  return "BAD_RESPONSE";
}

export async function unwrap<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  // A 204 is a SUCCESS that has no body by definition — declining a chat
  // request, leaving a group, removing a member all answer with one. Without
  // this they fell through to the envelope check below, found no
  // `success: true`, and threw BAD_RESPONSE on a call that had worked.
  if (res.ok && text.trim() === "") return undefined as T;
  const body = parseBody(text) as {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  if (res.ok && body && body.success === true) return body.data as T;
  const err = body?.error;
  const message = err?.message ?? (text.trim() || fallbackMessage);
  throw apiError(err?.code ?? fallbackCode(res.status), message, res.status, err?.details);
}

// The error code a failed call carried, or null when the throw did not come
// from the gateway at all (a network drop, a bug in our own code).
export function errorCode(error: unknown): string | null {
  return (error as GatewayApiError | null)?.code ?? null;
}

/**
 * Field-level validation messages a user can act on.
 *
 * Keyed on the field name the service reports, because the wording of the
 * underlying validator is not ours to depend on.
 */
const VALIDATION_COPY: Array<[RegExp, string]> = [
  [/deepLink/i, "Choose what this is about before saving."],
  [/startsAt/i, "Pick a valid date and time."],
  [/title/i, "Add a title."],
  [/\btext\b/i, "Write something first."],
];

function humaniseValidation(message: string | undefined): string | null {
  if (!message) return null;
  for (const [pattern, copy] of VALIDATION_COPY) {
    if (pattern.test(message)) return copy;
  }
  return null;
}

// Human copy for an error near the action that caused it. Raw codes never
// reach the screen.
export function errorMessage(error: unknown, fallback: string): string {
  const err = error as Partial<GatewayApiError> | null;
  if (!err) return fallback;
  switch (err.code) {
    case "UNAUTHORIZED":
      return "Sign in to continue.";
    case "SESSION_EXPIRED":
      return "Session expired — sign in again.";
    case "AUTH_NOT_READY":
      return "Still connecting — try again in a moment.";
    case "FORBIDDEN":
      return "You don't have access to that.";
    case "NOT_FOUND":
      return "That wasn't found — it may have been removed.";
    case "RATE_LIMITED":
      return "Slow down — try again in a moment.";
    case "PAYMENT_FAILED":
      return "KASH payment failed — check your balance.";
    case "CONFLICT":
      return "That's already taken.";
    // Storage or another upstream dependency failed. The user cannot act on
    // "Internal server error", and it reads as though THEY broke something —
    // say what is actually true and that it is known.
    case "PROVIDER_ERROR":
    case "STORAGE_ERROR":
      return "Uploads are temporarily unavailable — this is being fixed.";
    // The bytes never reached storage: CORS, a dropped connection, or a
    // cancelled transfer. Distinct from an API failure.
    // These are raised by the uploader itself with a message that already
    // names the file's real size or the specific failure, so keep it and fall
    // back to the generic wording only when there is none.
    case "UPLOAD_BLOCKED":
      return (
        err.message ||
        "The upload was blocked before it finished — check your connection and try again."
      );
    case "PRESIGN_EXPIRED":
      return err.message || "The upload link expired — try again.";
    case "STORAGE_REJECTED":
      return err.message || "Storage refused that file — try again.";
    case "PAYLOAD_TOO_LARGE":
      return err.message || "That file is too large to send this way.";
    case "VALIDATION":
      // Zod's messages are written for developers — "deepLink: Invalid input:
      // expected object, received undefined" tells a user nothing. Translate
      // the ones a user can actually hit; anything else keeps the raw message,
      // which is still better than a bare code.
      return humaniseValidation(err.message) ?? err.message ?? fallback;
    case "SERVICE_UNAVAILABLE":
      /**
       * KEEP the upstream's own message when it sent one.
       *
       * This used to answer "Market Square is unreachable right now."
       * unconditionally, and that is a claim about the whole product. The
       * service uses this code for a SINGLE CAPABILITY being unavailable too
       * — "LiveKit room creation failed" is one, and going live returned it
       * while the feed, messages and everything else were answering in under
       * a second. Every creator who tried was told the square was down, and
       * whoever they told read it as an outage.
       *
       * So the specific message wins and the generic line is only the
       * fallback, which is the same rule four codes above already follow. The
       * proxy's own transport failure carries "Market Square is unreachable."
       * as its message, so a real outage still reads as one.
       */
      return err.message || "Market Square is unreachable right now.";
    default:
      return err.message || fallback;
  }
}
