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

import {
  recordUpstreamFailure,
  recordUpstreamSuccess,
  upstreamIsOpen,
  upstreamTimeoutMs,
} from "./upstream-health.ts";

export interface ForwardResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Does this Authorization header carry a Decane token?
 *
 * Since the move to Decane, a browser can hold a NEW Decane session and still
 * carry the OLD account's `privy-id-token` cookie. Forwarding that beside the
 * Decane bearer would hand the service the old account's wallet for the new
 * identity — so the Privy identity token travels only with a Privy session.
 *
 * Read WITHOUT verifying, and that is enough: it decides only whether to
 * forward an extra header, and the service verifies whatever it is given.
 * Decane tokens carry a `project_id` and no `iss`; Privy's carry `iss:
 * privy.io` — the same peek the service's own verifier routes on.
 */
export function isDecaneBearer(authorization: string | null): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const payload = authorization.slice("Bearer ".length).split(".")[1];
  if (!payload) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      iss?: unknown;
      project_id?: unknown;
    };
    return claims.iss === undefined && typeof claims.project_id === "string";
  } catch {
    return false;
  }
}

/** Privy's signed identity token — carries the linked accounts, including the wallet. */
const PRIVY_IDENTITY_HEADER = "privy-id-token";

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

/**
 * One cookie out of a Cookie header.
 *
 * `req` here is a plain `Request`, deliberately — it is what makes this
 * testable without Next — so there is no `.cookies` accessor to reach for.
 */
function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    return value.length > 0 ? decodeURIComponent(value) : null;
  }
  return null;
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

  /**
   * The Privy IDENTITY token, forwarded so the service can learn the caller's
   * wallet.
   *
   * The access token carries only the DID, so without this the service has no
   * address to pay: every profile is created with a null wallet, and a tip is
   * refused with "This author has no wallet to receive tips" no matter how
   * well the rest of the payment path works.
   *
   * Safe to forward because the service VERIFIES it — it is a signed token,
   * not a claim. Read from the cookie as well as the header, since Privy sets
   * it as a cookie and a plain `fetch` from our own pages sends neither
   * automatically.
   */
  const identity =
    req.headers.get(PRIVY_IDENTITY_HEADER) ??
    cookieValue(req.headers.get("cookie"), PRIVY_IDENTITY_HEADER);
  if (identity && !isDecaneBearer(auth)) headers[PRIVY_IDENTITY_HEADER] = identity;

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

  // The upstream has been failing consecutively and this instance has stopped
  // asking. Answering here costs about a millisecond; asking would cost the
  // full timeout in billed memory to arrive at the same answer.
  if (upstreamIsOpen()) {
    return fail(503, "SERVICE_UNAVAILABLE", "Square is unreachable.", { requestId });
  }

  let res: Response;
  try {
    res = await doFetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(upstreamTimeoutMs(method, isMultipart)),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    // Same rule as below: a transport failure on a read is the signal the
    // breaker is for; on a write it is one person's action failing.
    if (method === "GET" || method === "HEAD") recordUpstreamFailure();
    log.error(
      `[ms-proxy] ${method} ${route} upstream request failed (requestId=${requestId}, bytes=${body?.byteLength ?? 0}):`,
      errorLabel(error)
    );
    return timedOut
      ? fail(504, "UPSTREAM_TIMEOUT", "Square took too long to respond. Try again.", { requestId })
      : fail(502, "SERVICE_UNAVAILABLE", "Square is unreachable.", { requestId });
  }

  /**
   * A 5xx is the service being unwell; a 4xx is it working and saying no. But
   * WHICH REQUEST failed matters as much as how.
   *
   * The breaker exists to stop this instance burning billed memory waiting on
   * a dead upstream, and what does that is POLLING — the feed, presence,
   * unread, chat, all retrying on their own. A write is one deliberate act by
   * one person, and letting it shut the circuit means a single broken
   * CAPABILITY takes down every read in the app: a creator pressing "Go live"
   * five times against a service whose LiveKit credentials were missing put
   * the whole square behind "Market Square is unreachable" for everyone that
   * instance served, while the feed itself was answering fine.
   *
   * So reads inform the breaker and writes do not. A genuine outage is
   * indistinguishable to the polls, which see it within a second or two and
   * open the circuit exactly as before; a capability that is merely
   * misconfigured now fails only for the person who asked for it. Writes are
   * still REFUSED while the circuit is open — that half is about not paying
   * to wait on a corpse, and it stands.
   */
  const informsBreaker = method === "GET" || method === "HEAD";
  if (res.status >= 500) {
    if (informsBreaker) recordUpstreamFailure();
  } else if (informsBreaker) {
    recordUpstreamSuccess();
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
      `Square returned ${res.status}${res.statusText ? ` ${res.statusText}` : ""} without an error body.`,
      { requestId: upstreamRequestId }
    );
  }

  // A bare INTERNAL_ERROR tells the reader nothing and cannot be traced. Keep
  // the upstream code, but say which request it was so it can be looked up.
  if (upstream.code === "INTERNAL_ERROR") {
    return fail(
      res.status,
      "INTERNAL_ERROR",
      `Square failed while handling this request (reference ${upstreamRequestId}).`,
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
