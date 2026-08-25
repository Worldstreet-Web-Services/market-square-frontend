import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { forwardToUpstream, multipartBoundary } from "./proxy.ts";

/**
 * REGRESSION: the BFF forwarded multipart bodies as a stream
 * (`body: req.body`, `duplex: "half"`). On Vercel the body reached the service
 * empty, and an empty multipart makes multer throw a plain
 * `Error("Unexpected end of form")` — not a `MulterError` — which the service
 * turns into a bare `500 INTERNAL_ERROR / "Internal server error"`. Every
 * image upload in production failed that way.
 *
 * These tests put a real multipart body through `forwardToUpstream` into a
 * stub upstream and assert the bytes, the content-type and the boundary all
 * arrive exactly as sent. Nothing here mocks the body handling itself — that
 * is the thing under test.
 */

const silent = { error: () => {}, warn: () => {} };

interface Seen {
  method: string;
  headers: Record<string, string>;
  bytes: Buffer;
}

/** A stub upstream that records exactly what it received. */
function stubUpstream(respond: () => Response) {
  const seen: Seen[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const body = init?.body;
    const bytes =
      body instanceof ArrayBuffer
        ? Buffer.from(body)
        : body === undefined || body === null
          ? Buffer.alloc(0)
          : Buffer.from(String(body));
    seen.push({ method: init?.method ?? "GET", headers, bytes });
    return respond();
  }) as unknown as typeof fetch;
  return { seen, fetchImpl };
}

function okEnvelope() {
  return new Response(JSON.stringify({ success: true, data: { url: "https://cdn/x.png" } }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}

/** A 512 KB PNG-ish payload — the size that failed in production. */
function multipartBody() {
  const boundary = `----formdata${randomBytes(12).toString("hex")}`;
  const file = randomBytes(512 * 1024);
  const raw = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="photo.png"\r\n` +
        `Content-Type: image/png\r\n\r\n`
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { boundary, raw, contentType: `multipart/form-data; boundary=${boundary}` };
}

const sha = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");

describe("forwardToUpstream — multipart", () => {
  it("delivers the body byte-for-byte, with the boundary intact", async () => {
    const { boundary, raw, contentType } = multipartBody();
    const { seen, fetchImpl } = stubUpstream(okEnvelope);

    const result = await forwardToUpstream({
      req: new Request("http://bff/api/market-square/uploads", {
        method: "POST",
        headers: { "content-type": contentType, authorization: "Bearer token" },
        body: new Uint8Array(raw),
      }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      logger: silent,
    });

    assert.equal(seen.length, 1);
    const [call] = seen;

    // The bytes: identical, and NOT empty (the production failure was empty).
    assert.equal(call.bytes.byteLength, raw.byteLength);
    assert.equal(sha(call.bytes), sha(raw));

    // The content-type: verbatim, boundary parameter and all. A rewritten or
    // regenerated boundary corrupts the payload as badly as losing the bytes.
    assert.equal(call.headers["content-type"], contentType);
    assert.equal(multipartBoundary(call.headers["content-type"]), boundary);

    // An explicit content-length, so no hop has to cope with chunked framing.
    assert.equal(call.headers["content-length"], String(raw.byteLength));

    assert.equal(call.headers.authorization, "Bearer token");
    assert.equal(result.status, 201);
  });

  it("rejects a multipart content-type with no boundary instead of forwarding it", async () => {
    const { raw } = multipartBody();
    const { seen, fetchImpl } = stubUpstream(okEnvelope);

    const result = await forwardToUpstream({
      req: new Request("http://bff/api/market-square/uploads", {
        method: "POST",
        headers: { "content-type": "multipart/form-data" },
        body: new Uint8Array(raw),
      }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      requestId: "rid-1",
      logger: silent,
    });

    assert.equal(seen.length, 0, "nothing may be forwarded");
    assert.equal(result.status, 400);
    assert.equal(JSON.parse(result.body).error.code, "MALFORMED_UPLOAD");
  });

  it("rejects an empty multipart body rather than letting it become a 500", async () => {
    const { contentType } = multipartBody();
    const { seen, fetchImpl } = stubUpstream(okEnvelope);

    const result = await forwardToUpstream({
      req: new Request("http://bff/api/market-square/uploads", {
        method: "POST",
        headers: { "content-type": contentType },
        body: new Uint8Array(0),
      }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      logger: silent,
    });

    assert.equal(seen.length, 0);
    assert.equal(result.status, 400);
    assert.equal(JSON.parse(result.body).error.code, "MALFORMED_UPLOAD");
  });
});

describe("forwardToUpstream — JSON", () => {
  it("forwards a JSON body unchanged with its own content-type", async () => {
    const { seen, fetchImpl } = stubUpstream(okEnvelope);
    const payload = JSON.stringify({ text: "héllo — ünicode" });

    await forwardToUpstream({
      req: new Request("http://bff/api/market-square/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      }),
      url: "http://upstream/v1/market-square/posts",
      method: "POST",
      fetchImpl,
      logger: silent,
    });

    assert.equal(seen[0].bytes.toString("utf8"), payload);
    assert.equal(seen[0].headers["content-type"], "application/json");
    assert.equal(seen[0].headers["content-length"], String(Buffer.byteLength(payload)));
  });

  it("sends no body or content-length for a GET", async () => {
    const { seen, fetchImpl } = stubUpstream(okEnvelope);
    await forwardToUpstream({
      req: new Request("http://bff/api/market-square/categories"),
      url: "http://upstream/v1/market-square/categories",
      method: "GET",
      fetchImpl,
      logger: silent,
    });
    assert.equal(seen[0].bytes.byteLength, 0);
    assert.equal(seen[0].headers["content-length"], undefined);
  });
});

describe("forwardToUpstream — honest errors", () => {
  it("passes a specific upstream error through untouched", async () => {
    const upstreamBody = JSON.stringify({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Upload rejected: LIMIT_FILE_SIZE" },
    });
    const { fetchImpl } = stubUpstream(
      () => new Response(upstreamBody, { status: 400, headers: { "content-type": "application/json" } })
    );

    const result = await forwardToUpstream({
      req: new Request("http://bff/x", { method: "POST", body: "{}" , headers: { "content-type": "application/json" } }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      logger: silent,
    });

    assert.equal(result.status, 400);
    assert.equal(JSON.parse(result.body).error.message, "Upload rejected: LIMIT_FILE_SIZE");
  });

  it("makes a bare upstream INTERNAL_ERROR traceable instead of repeating it", async () => {
    const { fetchImpl } = stubUpstream(
      () =>
        new Response(
          JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } }),
          { status: 500, headers: { "content-type": "application/json", "x-request-id": "svc-42" } }
        )
    );

    const result = await forwardToUpstream({
      req: new Request("http://bff/x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      requestId: "rid-9",
      logger: silent,
    });

    const parsed = JSON.parse(result.body);
    assert.equal(result.status, 500);
    assert.notEqual(parsed.error.message, "Internal server error");
    assert.match(parsed.error.message, /svc-42/);
    assert.equal(parsed.error.details.requestId, "svc-42");
  });

  it("does not hand an HTML proxy page to the client's JSON parser", async () => {
    const { fetchImpl } = stubUpstream(
      () => new Response("<html>413 Request Entity Too Large</html>", { status: 413 })
    );
    const result = await forwardToUpstream({
      req: new Request("http://bff/x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      requestId: "rid-3",
      logger: silent,
    });
    assert.equal(result.status, 413);
    const parsed = JSON.parse(result.body);
    assert.equal(parsed.error.code, "UPSTREAM_ERROR");
    assert.equal(parsed.error.details.requestId, "rid-3");
  });

  it("reports a timeout as a timeout, not as unreachable", async () => {
    const fetchImpl = (async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;

    const result = await forwardToUpstream({
      req: new Request("http://bff/x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      logger: silent,
    });
    assert.equal(result.status, 504);
    assert.equal(JSON.parse(result.body).error.code, "UPSTREAM_TIMEOUT");
  });

  it("logs the route, upstream status and error label — and no secrets", async () => {
    const lines: string[] = [];
    const { fetchImpl } = stubUpstream(
      () =>
        new Response(
          JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } }),
          { status: 500 }
        )
    );

    await forwardToUpstream({
      req: new Request("http://bff/x", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer super-secret-token" },
        body: '{"secret":"do-not-log-me"}',
      }),
      url: "http://upstream/v1/market-square/uploads",
      method: "POST",
      fetchImpl,
      requestId: "rid-7",
      logger: { error: (...args: unknown[]) => lines.push(args.join(" ")), warn: () => {} },
    });

    const logged = lines.join("\n");
    assert.match(logged, /\/v1\/market-square\/uploads/);
    assert.match(logged, /upstream 500/);
    assert.match(logged, /code=INTERNAL_ERROR/);
    assert.match(logged, /rid-7/);
    assert.doesNotMatch(logged, /super-secret-token/);
    assert.doesNotMatch(logged, /do-not-log-me/);
  });
});
