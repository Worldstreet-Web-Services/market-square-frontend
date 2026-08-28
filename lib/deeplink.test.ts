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

test("Ark product links resolve against the verified Ark origin", () => {
  // www.tsionark.com, confirmed: it serves /dashboard, /activity and
  // /api/square/symbols, and its title is "Ark". Two earlier guesses were
  // wrong — worldstreetgold.com is the marketing site and
  // dashboard.worldstreetgold.com is a Clerk app while Ark runs on Privy — and
  // a wrong origin does not fail loudly, it lands on somebody else's 404.
  const link = resolveDeepLink({ kind: "market", ref: "m1" });
  assert.equal(link.available, true);
  assert.match(link.href, /^https:\/\/www\.tsionark\.com\//);
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
    // The PATH is asserted independently of the origin, so these keep guarding
    // the routes even while the base is unset.
    assert.match(resolveDeepLink({ kind: "listing", ref: "solar-farm" }).href,
      /\/earn\/listing\/solar-farm$/);
  });

  it("sends a market and a prediction to /prediction/<id>", () => {
    for (const kind of ["market", "prediction"]) {
      assert.match(resolveDeepLink({ kind, ref: "abc" }).href, /\/prediction\/abc$/, kind);
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
    // A trade does NOT depend on the Ark origin: a block explorer is a public
    // address anybody can verify, which is why it still works unconfigured.
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

describe("a ticker opens Ark's buy sheet", () => {
  // It used to resolve as `market`, which routes to /prediction/<ref> — a
  // prediction market, a different product. $ETH landed on /prediction/ETH,
  // which does not exist and simply spins.
  it("points at ?buy=SYMBOL on the dashboard, not a prediction market", () => {
    const link = resolveDeepLink({ kind: "buy", ref: "eth" });
    assert.ok(link.available);
    assert.match(link.href, /\/dashboard\?buy=ETH$/);
    assert.ok(!link.href.includes("/prediction/"));
    assert.equal(link.external, true);
  });

  it("upper-cases and encodes the symbol", () => {
    assert.match(resolveDeepLink({ kind: "buy", ref: "cbbtc" }).href, /buy=CBBTC$/);
  });
});
