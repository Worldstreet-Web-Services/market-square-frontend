/**
 * The BFF's upstream forward, extracted from the route handler so it can be
 * unit-tested against a stub upstream (route files own no logic — CLAUDE.md).
 *
 * Dependency-free and alias-free on purpose: `lib/**` tests run under
 * `node --test` with native type stripping, which resolves neither `@/` nor
 * `server-only`.
 *
 * ── Why the body is BUFFERED, not streamed ──────────────────────────────────
 *
 * This used to forward multipart bodies as `body: req.body` with
 * `duplex: "half"`. On Vercel that produced a request whose body arrived at
 * the service empty, and multer answers an empty (or truncated, or
 * boundary-less) multipart with a plain `Error("Unexpected end of form")` —
 * not a `MulterError` — which falls through to the service's unhandled-error
 * branch and becomes a bare `500 INTERNAL_ERROR / "Internal server error"`.
 * That envelope was passed straight back to the browser, which is exactly the
 * production symptom. JSON POSTs were unaffected because they already took the
 * buffered `await req.text()` path.
 *
 * Buffering is safe here without a memory argument: Vercel rejects any request
 * body over 4.5 MB before our code runs, so this can never hold more than
 * that, and `lib/upload-rules.ts` routes anything larger to direct-to-storage.
 *
 * Buffering also lets us send an explicit `content-length` instead of relying
 * on chunked transfer-encoding across the CDN → function → gateway → service
 * hops, and lets us reject a boundary-less multipart here with a clear 400
 * rather than shipping it on to become someone else's 500.
 */

export interface ForwardResult {
  status: number;
  body: string;
  contentType: string;
}

export interface ForwardOptions {
  /** The incoming request. Plain `Request` — `NextRequest` satisfies it. */
  req: Request;
  /** Fully-resolved upstream URL, query string included. */
  url: string;
  method: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected for tests; defaults to `crypto.randomUUID()`. */
  requestId?: string;
  /** Injected for tests so failures do not spam the runner. */
  logger?: Pick<Console, "error" | "warn">;
}

const JSON_CT = "application/json";

function envelope(code: string, message: string, details?: unknown): string {
  return JSON.stringify({ success: false, error: { code, message, ...(details ? { details } : {}) } });
}

function fail(status: number, code: string, message: string, details?: unknown): ForwardResult {
  return { status, body: envelope(code, message, details), contentType: JSON_CT };
}

/** Does this body look like our `{ success, error: { code, message } }` envelope? */
function readEnvelope(text: string): { code: string; message: string } | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } };
    const code = parsed?.error?.code;
    const message = parsed?.error?.message;
    if (typeof code === "string" && typeof message === "string") return { code, message };
  } catch {
    /* not JSON — handled by the caller */
  }
  return null;
}

/**
 * A body we can hand to `fetch` plus the headers that describe it exactly.
 *
 * The `content-type` is copied VERBATIM: for multipart it carries the
 * `boundary` parameter, and rewriting or dropping it corrupts the payload just
 * as thoroughly as losing the bytes.
 */
export interface PreparedBody {
  bytes: ArrayBuffer;
  headers: Record<string, string>;
}

export function prepareHeaders(contentType: string, byteLength: number): Record<string, string> {
  return {
    "content-type": contentType || JSON_CT,
    "content-length": String(byteLength),
  };
}

/** `multipart/form-data; boundary=abc` → `abc`. Null when absent or empty. */
export function multipartBoundary(contentType: string): string | null {
  if (!contentType.toLowerCase().startsWith("multipart/")) return null;
  const match = /;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const value = match?.[1] ?? match?.[2] ?? "";
  return value.length > 0 ? value : null;
}

export async function forwardToUpstream(options: ForwardOptions): Promise<ForwardResult> {
  const { req, url, method } = options;
  const doFetch = options.fetchImpl ?? fetch;
  const log = options.logger ?? console;
  const requestId = options.requestId ?? globalThis.crypto.randomUUID();
  const route = new URL(url, "http://placeholder.invalid").pathname;

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.toLowerCase().startsWith("multipart/");

  const headers: Record<string, string> = { accept: JSON_CT, "x-request-id": requestId };
  const auth = req.headers.get("authorization");
  if (auth) headers.authorization = auth;

  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    if (isMultipart && !multipartBoundary(contentType)) {
      log.error(
        `[ms-proxy] ${method} ${route} rejected: multipart content-type carries no boundary (requestId=${requestId})`
      );
      return fail(
        400,
        "MALFORMED_UPLOAD",
        "The upload was malformed — its multipart boundary was missing. Try again.",
        { requestId }
      );
    }

    // Buffer rather than stream. See the module header for why.
    let buffered: ArrayBuffer;
    try {
      buffered = await req.arrayBuffer();
    } catch (error) {
      log.error(
        `[ms-proxy] ${method} ${route} could not read the request body (requestId=${requestId}):`,
        errorLabel(error)
      );
      return fail(
        400,
        "MALFORMED_UPLOAD",
        "The upload did not arrive completely — check your connection and try again.",
        { requestId }
      );
    }

    // An empty multipart body is the corruption itself: the service answers it
    // with a bare 500. Name it here instead of forwarding it on.
    if (isMultipart && buffered.byteLength === 0) {
      log.error(
        `[ms-proxy] ${method} ${route} rejected: multipart body arrived empty (requestId=${requestId})`
      );
      return fail(
        400,
        "MALFORMED_UPLOAD",
        "The upload arrived empty — check your connection and try again.",
        { requestId }
      );
    }

    if (buffered.byteLength > 0) {
      body = buffered;
      Object.assign(headers, prepareHeaders(contentType, buffered.byteLength));
    }
  }

  let res: Response;
  try {
    res = await doFetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(isMultipart ? 120_000 : 15_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    log.error(
      `[ms-proxy] ${method} ${route} upstream request failed (requestId=${requestId}, bytes=${body?.byteLength ?? 0}):`,
      errorLabel(error)
    );
    return timedOut
      ? fail(504, "UPSTREAM_TIMEOUT", "Market Square took too long to respond. Try again.", { requestId })
      : fail(502, "SERVICE_UNAVAILABLE", "Market Square is unreachable.", { requestId });
  }

  const text = await res.text().catch(() => "");
  if (res.ok) return { status: res.status, body: text, contentType: JSON_CT };

  const upstream = readEnvelope(text);
  const upstreamRequestId = res.headers.get("x-request-id") ?? requestId;

  // Every non-2xx is logged with enough to find it in the service's logs and
  // nothing that could be a secret or file content.
  log.error(
    `[ms-proxy] ${method} ${route} upstream ${res.status} ${res.statusText || ""} ` +
      `(requestId=${upstreamRequestId}, bytes=${body?.byteLength ?? 0}, code=${upstream?.code ?? "<no envelope>"})`
  );

  if (!upstream) {
    // Not our envelope at all — an nginx page, an empty body, a proxy error.
    // Returning it verbatim would put HTML through a JSON parser.
    return fail(
      res.status,
      "UPSTREAM_ERROR",
      `Market Square returned ${res.status}${res.statusText ? ` ${res.statusText}` : ""} without an error body.`,
      { requestId: upstreamRequestId }
    );
  }

  // A bare INTERNAL_ERROR tells the reader nothing and cannot be traced. Keep
  // the upstream code, but say which request it was so it can be looked up.
  if (upstream.code === "INTERNAL_ERROR") {
    return fail(
      res.status,
      "INTERNAL_ERROR",
      `Market Square failed while handling this request (reference ${upstreamRequestId}).`,
      { requestId: upstreamRequestId }
    );
  }

  // Anything else is a real, specific upstream error — pass it through as-is.
  return { status: res.status, body: text, contentType: JSON_CT };
}

/** `TypeError: fetch failed` — never the stack, never the payload. */
function errorLabel(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` (cause: ${error.cause.name}: ${error.cause.message})` : "";
    return `${error.name}: ${error.message}${cause}`;
  }
  return String(error);
}
