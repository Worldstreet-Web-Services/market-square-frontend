import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import { resolveCta, resolveDeepLink } from "./deeplink.ts";

test("internal kinds route inside the app and are always available", () => {
  const link = resolveDeepLink({ kind: "stream", ref: "s1" });
  assert.deepEqual(link, { href: "/live/s1", external: false, label: "Watch", available: true });
});

test("a source is threaded onto internal destinations", () => {
  assert.equal(resolveDeepLink({ kind: "store_item", ref: "x" }, "home").href, "/store/x?source=home");
});

test("Ark product links resolve against the built-in origin", () => {
  // This test used to assert the opposite, and was right to: with no verified
  // Ark origin, an inert row beat a link into a host that answered nothing.
  // The origin is confirmed now, so the rule inverts — but `available` still
  // earns its keep, because a link with nowhere to point is still withheld.
  assert.equal(resolveDeepLink({ kind: "market", ref: "m1" }).available, true);
  assert.match(resolveDeepLink({ kind: "market", ref: "m1" }).href, /^https:\/\//);
  // A section with no ref is the section itself, never ".../listings/".
  assert.ok(!resolveDeepLink({ kind: "listing", ref: "" }).href.endsWith("/"));
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

describe("Ark product links resolve to routes Ark actually serves", () => {
  // These used to point at /listings/ and /markets/, which Ark has never had.
  // Every one of them would have 404'd the moment an origin was configured,
  // and nothing caught it because with no origin they were all inert.
  it("sends a listing to /earn/listing/<slug>", () => {
    const link = resolveDeepLink({ kind: "listing", ref: "solar-farm" });
    assert.ok(link.available);
    assert.match(link.href, /\/earn\/listing\/solar-farm$/);
  });

  it("sends a market and a prediction to /prediction/<id>", () => {
    for (const kind of ["market", "prediction"]) {
      const link = resolveDeepLink({ kind, ref: "abc" });
      assert.ok(link.available, `${kind} must resolve`);
      assert.match(link.href, /\/prediction\/abc$/);
    }
  });

  it("sends an activity to /activity", () => {
    assert.match(resolveDeepLink({ kind: "activity", ref: "" }).href, /\/activity$/);
  });
});

describe("a shared trade opens the transaction, not the reader's own activity", () => {
  // /activity would show whoever is READING their own trades, not the trade
  // that was shared. The explorer is the one destination that is the same
  // thing for everybody.
  it("resolves to the explorer for the network it settled on", () => {
    const hash = `0x${"a".repeat(64)}`;
    const link = resolveDeepLink({ kind: "trade", ref: `base-mainnet:${hash}` });
    assert.ok(link.available);
    assert.equal(link.href, `https://basescan.org/tx/${hash}`);
    assert.equal(link.external, true);
  });

  it("splits on the FIRST colon, so a hash keeps its own", () => {
    const link = resolveDeepLink({ kind: "trade", ref: "solana-mainnet:aa:bb" });
    assert.match(link.href, /solscan\.io\/tx\/aa%3Abb$/);
  });

  it("offers nothing rather than guessing an unknown chain", () => {
    assert.equal(resolveDeepLink({ kind: "trade", ref: "moon-mainnet:0xabc" }).available, false);
    assert.equal(resolveDeepLink({ kind: "trade", ref: "base-mainnet" }).available, false);
    assert.equal(resolveDeepLink({ kind: "trade", ref: "" }).available, false);
  });

  it("is withheld by resolveCta when it cannot resolve", () => {
    assert.equal(resolveCta({ kind: "trade", ref: "moon-mainnet:0xabc" }), null);
  });
});
