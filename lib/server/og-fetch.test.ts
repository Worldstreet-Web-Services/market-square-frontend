import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchOgJson } from "./og-fetch.ts";
import { marketSquareBase } from "./upstream-base.ts";

type Init = RequestInit;
const notFound = (message: string) =>
  new Response(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message } }), { status: 404 });

function stub(response: () => Response | Promise<Response>) {
  const calls: { url: string; init: Init }[] = [];
  const fetchImpl = async (url: string, init: Init) => {
    calls.push({ url, init });
    return response();
  };
  return { calls, fetchImpl };
}

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

describe("the share-preview read", () => {
  it("is anonymous, bounded, and never cached across requests", async () => {
    const { calls, fetchImpl } = stub(() => ok({ id: "x" }));
    const result = await fetchOgJson("https://gw.test/v1/market-square/posts/x", { fetchImpl });
    assert.deepEqual(result, { status: "ok", data: { id: "x" } });
    const init = calls[0].init;
    assert.equal(init.method, "GET");
    assert.ok(init.signal instanceof AbortSignal);
    // A cached success is served STALE while it refetches, and a 404 is never
    // written back — so any cache here keeps a removed post's card alive.
    assert.equal(init.cache, "no-store");
    assert.equal(init.next, undefined);
    const headers = new Headers(init.headers);
    assert.equal(headers.get("authorization"), null);
    assert.equal(headers.get("cookie"), null);
  });

  it("calls a post or profile gone only when the service says it does not exist", async () => {
    assert.deepEqual(await fetchOgJson("u", stub(() => notFound("Post not found"))), { status: "not-found" });
    assert.deepEqual(await fetchOgJson("u", stub(() => notFound("Profile not found"))), { status: "not-found" });
  });

  it("does not read a misrouted gateway as gone, which would 404 every post at once", async () => {
    // Real production bodies: same status, same code, different cause.
    for (const response of [
      () => notFound("Route not found"),
      () => notFound("Unknown service: market-squar"),
      () => new Response("", { status: 404 }),
      () => new Response("<html>404</html>", { status: 404 }),
    ]) {
      assert.deepEqual(await fetchOgJson("u", stub(response)), { status: "unavailable" });
    }
  });

  it("answers every other non-200 as unavailable", async () => {
    for (const status of [500, 502, 503, 504, 401, 403, 429, 201, 204]) {
      const result = await fetchOgJson("u", stub(() => new Response(status === 204 ? null : "{}", { status })));
      assert.deepEqual(result, { status: "unavailable" }, String(status));
    }
  });

  it("answers a timeout, a dropped connection or a body that is not our envelope as unavailable", async () => {
    const timeout = await fetchOgJson("u", {
      timeoutMs: 5,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    });
    assert.deepEqual(timeout, { status: "unavailable" });
    assert.deepEqual(
      await fetchOgJson("u", { fetchImpl: async () => Promise.reject(new TypeError("fetch failed")) }),
      { status: "unavailable" }
    );
    for (const body of ["<html>nginx</html>", "", "null", '{"success":false,"error":{"code":"X","message":"y"}}', '{"success":true}', '{"success":true,"data":"text"}']) {
      assert.deepEqual(await fetchOgJson("u", stub(() => new Response(body, { status: 200 }))), { status: "unavailable" }, body);
    }
  });
});

describe("the upstream base", () => {
  it("is the BFF's own resolution, and nothing when the gateway is unset", () => {
    assert.equal(marketSquareBase({ WSAPI_BASE_URL: "https://gw.test" }), "https://gw.test/v1/market-square");
    assert.equal(marketSquareBase({}), null);
    assert.equal(marketSquareBase({ WSAPI_BASE_URL: "" }), null);
  });
});
