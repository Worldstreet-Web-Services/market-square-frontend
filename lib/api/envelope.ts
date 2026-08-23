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

// Human copy for an error near the action that caused it. Raw codes never
// reach the screen.
export function errorMessage(error: unknown, fallback: string): string {
  const err = error as Partial<GatewayApiError> | null;
  if (!err) return fallback;
  switch (err.code) {
    case "UNAUTHORIZED":
      return "Sign in to continue.";
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
    case "SERVICE_UNAVAILABLE":
      return "Market Square is unreachable right now.";
    default:
      return err.message || fallback;
  }
}
