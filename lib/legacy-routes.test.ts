import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { describe, it } from "node:test";
import { LEGACY_ROUTES, legacyRedirects } from "./legacy-routes.ts";

describe("every route that moved under /square keeps its old address", () => {
  it("names EXACTLY the route directories in app/square — no drift in either direction", () => {
    // A route added under app/square without a redirect ships a URL that was
    // never handed out, which is fine; a route that EXISTED at the root and
    // lost its redirect breaks every link already shared. Comparing against the
    // real tree makes both mistakes fail here instead of in someone's inbox.
    const dir = new URL("../app/square/", import.meta.url);
    const onDisk = readdirSync(dir)
      .filter((name) => statSync(new URL(name, dir)).isDirectory())
      .filter((name) => name !== "api")
      .sort();
    assert.deepEqual([...LEGACY_ROUTES].sort(), onDisk);
  });

  it("sends the front page to /square", () => {
    const root = legacyRedirects().find((rule) => rule.source === "/");
    assert.equal(root?.destination, "/square");
  });

  it("redirects a route and everything under it", () => {
    const rules = legacyRedirects();
    assert.ok(rules.some((r) => r.source === "/p" && r.destination === "/square/p"));
    assert.ok(rules.some((r) => r.source === "/p/:rest*" && r.destination === "/square/p/:rest*"));
    assert.ok(rules.some((r) => r.source === "/u/:rest*" && r.destination === "/square/u/:rest*"));
  });

  it("carries the BFF, so a stale tab's POST still lands", () => {
    const rule = legacyRedirects().find((r) => r.source === "/api/:rest*");
    assert.equal(rule?.destination, "/square/api/:rest*");
  });

  it("is temporary, so a rollback does not strand readers behind a cached redirect", () => {
    assert.ok(legacyRedirects().every((rule) => rule.permanent === false));
  });

  it("never redirects /square itself or Next's own assets", () => {
    for (const rule of legacyRedirects()) {
      assert.ok(!rule.source.startsWith("/square"), `loop risk: ${rule.source}`);
      assert.ok(!rule.source.startsWith("/_next"), `would break assets: ${rule.source}`);
    }
  });
});
