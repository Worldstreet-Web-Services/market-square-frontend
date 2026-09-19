import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { forwardToUpstream, isDecaneBearer, multipartBoundary } from "./proxy.ts";

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

/**
 * REGRESSION: a broken CAPABILITY took down the whole app.
 *
 * The market-square service answers `SERVICE_UNAVAILABLE` when a single
 * dependency is unconfigured — "LiveKit room creation failed" was one, and it
 * came back 502 through the gateway. Every one of those counted towards the
 * proxy's breaker, so a creator pressing "Go live" five times opened the
 * circuit and every READ through that instance then answered 503 for the
 * cooldown. The feed was healthy the entire time; the square just said it was
 * unreachable.
 */
describe("the breaker learns from reads, not from writes", () => {
  const boom = () =>
    new Response(
      JSON.stringify({
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "LiveKit room creation failed" },
      }),
      { status: 502, headers: { "content-type": "application/json" } }
    );

  it("a failing write never opens the circuit, however many times it fails", async () => {
    const { resetUpstreamHealth, upstreamHealth } = await import("./upstream-health.ts");
    resetUpstreamHealth();
    const { fetchImpl } = stubUpstream(boom);
    for (let i = 0; i < 10; i += 1) {
      await forwardToUpstream({
        req: new Request("http://x/go-live", { method: "POST", body: "{}" }),
        url: "http://upstream.invalid/streams/1/go-live",
        method: "POST",
        fetchImpl,
        logger: silent,
      });
    }
    assert.equal(upstreamHealth().failures, 0, "a write must not feed the breaker");
    assert.equal(upstreamHealth().openUntil, 0, "the circuit must still be closed");
    resetUpstreamHealth();
  });

  it("a failing READ still opens it — the case it exists for is unchanged", async () => {
    const { resetUpstreamHealth, upstreamHealth, FAILURE_THRESHOLD } = await import(
      "./upstream-health.ts"
    );
    resetUpstreamHealth();
    const { fetchImpl } = stubUpstream(boom);
    for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
      await forwardToUpstream({
        req: new Request("http://x/feed"),
        url: "http://upstream.invalid/feed",
        method: "GET",
        fetchImpl,
        logger: silent,
      });
    }
    assert.equal(upstreamHealth().failures, FAILURE_THRESHOLD);
    assert.ok(upstreamHealth().openUntil > Date.now(), "a real outage must still shut it");
    resetUpstreamHealth();
  });

  it("the upstream's own message survives, so a capability failure is not read as an outage", async () => {
    const { resetUpstreamHealth } = await import("./upstream-health.ts");
    resetUpstreamHealth();
    const { fetchImpl } = stubUpstream(boom);
    const result = await forwardToUpstream({
      req: new Request("http://x/go-live", { method: "POST", body: "{}" }),
      url: "http://upstream.invalid/streams/1/go-live",
      method: "POST",
      fetchImpl,
      logger: silent,
    });
    // Passed through verbatim: the client renders this message rather than
    // substituting a claim that the whole product is down.
    assert.match(result.body, /LiveKit room creation failed/u);
    resetUpstreamHealth();
  });
});

describe("the Privy identity token", () => {
  const capturing = (calls: { headers: Record<string, string> }[]) =>
    (async (_url: string, init: { headers: Record<string, string> }) => {
      calls.push({ headers: init.headers });
      return new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

  it("is forwarded so the service can learn the caller's wallet", async () => {
    // Without it the service only ever sees the DID, every profile keeps a
    // null wallet, and a tip is refused with "This author has no wallet to
    // receive tips" however well the rest of the payment path works.
    const calls: { headers: Record<string, string> }[] = [];
    await forwardToUpstream({
      req: new Request("http://localhost/api/market-square/me", {
        headers: { "privy-id-token": "signed-identity-token" },
      }),
      url: "http://upstream/me",
      method: "GET",
      fetchImpl: capturing(calls),
    });
    assert.equal(calls[0]!.headers["privy-id-token"], "signed-identity-token");
  });

  it("is read from the cookie when no header carries it", async () => {
    // Privy sets it as a cookie, and a plain fetch from our own pages sends
    // neither header nor cookie upstream on its own.
    const calls: { headers: Record<string, string> }[] = [];
    await forwardToUpstream({
      req: new Request("http://localhost/api/market-square/me", {
        headers: { cookie: "other=1; privy-id-token=from-cookie; another=2" },
      }),
      url: "http://upstream/me",
      method: "GET",
      fetchImpl: capturing(calls),
    });
    assert.equal(calls[0]!.headers["privy-id-token"], "from-cookie");
  });

  const jwt = (claims: Record<string, unknown>) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

  it("is NOT forwarded beside a Decane session", async () => {
    // A browser can hold a new Decane session AND the old account's identity
    // cookie. Sending both would hand the service the old account's wallet
    // for the new identity.
    const calls: { headers: Record<string, string> }[] = [];
    await forwardToUpstream({
      req: new Request("http://localhost/api/market-square/me", {
        headers: {
          authorization: `Bearer ${jwt({ uid: "u-1", project_id: "proj" })}`,
          cookie: "privy-id-token=old-account",
        },
      }),
      url: "http://upstream/me",
      method: "GET",
      fetchImpl: capturing(calls),
    });
    assert.equal("privy-id-token" in calls[0]!.headers, false);
  });

  it("tells a Decane bearer from a Privy one without verifying either", () => {
    assert.equal(isDecaneBearer(`Bearer ${jwt({ uid: "u", project_id: "p" })}`), true);
    assert.equal(isDecaneBearer(`Bearer ${jwt({ iss: "privy.io", sid: "s" })}`), false);
    assert.equal(isDecaneBearer("Bearer not-a-jwt"), false);
    assert.equal(isDecaneBearer(null), false);
  });

  it("is absent when there is nothing to send", async () => {
    const calls: { headers: Record<string, string> }[] = [];
    await forwardToUpstream({
      req: new Request("http://localhost/api/market-square/me"),
      url: "http://upstream/me",
      method: "GET",
      fetchImpl: capturing(calls),
    });
    assert.equal("privy-id-token" in calls[0]!.headers, false);
  });
});

/**
 * REGRESSION: a 204 from the service became a 5xx from the BFF.
 *
 * 204, 205 and 304 are "null body statuses" in the Fetch spec — constructing a
 * Response for one with ANY body init, including the empty string this proxy
 * carries for them, throws `TypeError: Response constructor: Invalid response
 * status code 204`.
 *
 * The throw lands AFTER the upstream call has already succeeded, so Next
 * answers 5xx for a request the service completed. The client then trips the
 * shared circuit breaker and reports "Can't reach Market Square right now"
 * about an action that worked.
 *
 * That is exactly what leaving a group looked like: the member really was
 * removed, the app said the square was unreachable, the confirm sheet stayed
 * open, and the next press hit a membership that was already gone and was
 * refused. Two routes answer 204 — leaving a group and declining a chat
 * request — so both were unusable through the proxy while both succeeded.
 *
 * These build the Response the route builds, because the bug was the
 * CONSTRUCTOR: asserting on the forward result alone never sees it.
 */
describe("forwardToUpstream — null-body statuses", () => {
  const NULL_BODY = new Set([204, 205, 304]);
  const build = (result: { status: number; body: string; contentType: string }) =>
    new Response(NULL_BODY.has(result.status) ? null : result.body, {
      status: result.status,
      headers: NULL_BODY.has(result.status) ? undefined : { "content-type": result.contentType },
    });

  for (const status of [204, 205, 304]) {
    it(`carries a ${status} through without throwing`, async () => {
      const { fetchImpl } = stubUpstream(() => new Response(null, { status }));
      const result = await forwardToUpstream({
        req: new Request("http://bff/api/market-square/conversations/c1/members/u1", {
          method: "DELETE",
        }),
        url: "http://upstream/v1/market-square/conversations/c1/members/u1",
        method: "DELETE",
        fetchImpl,
        logger: silent,
      });

      assert.equal(result.status, status);
      // The line that used to throw.
      const response = build(result);
      assert.equal(response.status, status);
      assert.equal(response.body, null);
    });
  }

  it("still gives an ordinary response its body and content type", async () => {
    const { fetchImpl } = stubUpstream(okEnvelope);
    const result = await forwardToUpstream({
      req: new Request("http://bff/api/market-square/categories"),
      url: "http://upstream/v1/market-square/categories",
      method: "GET",
      fetchImpl,
      logger: silent,
    });

    const response = build(result);
    // okEnvelope answers 201 — a status that DOES carry a body, which is the
    // contrast being drawn here.
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.notEqual(await response.text(), "");
  });
});
