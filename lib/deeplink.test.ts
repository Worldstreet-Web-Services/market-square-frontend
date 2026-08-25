import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCta, resolveDeepLink } from "./deeplink.ts";

test("internal kinds route inside the app and are always available", () => {
  const link = resolveDeepLink({ kind: "stream", ref: "s1" });
  assert.deepEqual(link, { href: "/live/s1", external: false, label: "Watch", available: true });
});

test("a source is threaded onto internal destinations", () => {
  assert.equal(resolveDeepLink({ kind: "store_item", ref: "x" }, "home").href, "/store/x?source=home");
});

test("Ark product links are unavailable while NEXT_PUBLIC_ARK_APP_URL is unset", () => {
  // The build under test has no Ark origin configured, so these must not be
  // offered as links at all — that is the whole point of `available`.
  assert.equal(resolveDeepLink({ kind: "listing", ref: "" }).available, false);
  assert.equal(resolveDeepLink({ kind: "market", ref: "m1" }).available, false);
  assert.equal(resolveCta({ kind: "listing", ref: "" }), null);
});

test("an author-supplied external URL stands on its own", () => {
  const link = resolveDeepLink({ kind: "external", ref: "https://example.com/a" });
  assert.equal(link.available, true);
  assert.equal(link.href, "https://example.com/a");
});

test("a non-URL external ref is not offered", () => {
  assert.equal(resolveCta({ kind: "external", ref: "not-a-url" }), null);
});

test("resolveCta passes a null link straight through", () => {
  assert.equal(resolveCta(null), null);
});
