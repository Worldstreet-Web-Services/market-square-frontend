import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SQUARE_BASE, api, asset, sq, stripSquare } from "./square-path.ts";

describe("sq — a route under the prefix", () => {
  it("prefixes a route", () => {
    assert.equal(sq("/feed"), "/square/feed");
    assert.equal(sq("/u/did:privy:abc"), "/square/u/did:privy:abc");
    assert.equal(sq("/messages?c=01a0"), "/square/messages?c=01a0");
  });

  it("maps the front page to /square, never /square/", () => {
    assert.equal(sq("/"), "/square");
  });

  it("keeps the cross-product share contract working from the root", () => {
    // Ark links to `/?compose=1&link=…`; the query must survive the hop.
    assert.equal(sq("/?compose=1&link=stream:abc"), "/square?compose=1&link=stream:abc");
    assert.equal(sq("/#top"), "/square#top");
  });

  it("is idempotent", () => {
    assert.equal(sq(sq("/feed")), "/square/feed");
    assert.equal(sq("/square"), "/square");
    assert.equal(sq("/square?x=1"), "/square?x=1");
  });

  it("leaves foreign addresses alone", () => {
    assert.equal(sq("https://www.tsionark.com/portfolio"), "https://www.tsionark.com/portfolio");
    assert.equal(sq("//cdn.example.com/a"), "//cdn.example.com/a");
    assert.equal(sq("#comments"), "#comments");
    assert.equal(sq("?tab=2"), "?tab=2");
    assert.equal(sq(""), "");
  });

  it("does not treat a lookalike prefix as ours", () => {
    // `/squared` is a different route, not the Square.
    assert.equal(sq("/squared"), "/square/squared");
  });
});

describe("asset and api", () => {
  it("prefix a public file and a BFF endpoint", () => {
    assert.equal(asset("/logo.svg"), "/square/logo.svg");
    assert.equal(asset("/notifications/notif-mention.svg"), "/square/notifications/notif-mention.svg");
    assert.equal(api("/api/kash"), "/square/api/kash");
    assert.equal(api("/api/market-square/me"), "/square/api/market-square/me");
  });

  it("are idempotent and leave foreign addresses alone", () => {
    assert.equal(asset(asset("/sw.js")), "/square/sw.js");
    assert.equal(api(api("/api/kash")), "/square/api/kash");
    assert.equal(asset("https://res.cloudinary.com/x.png"), "https://res.cloudinary.com/x.png");
    assert.equal(api("https://ark.example/api/square/symbols"), "https://ark.example/api/square/symbols");
  });
});

describe("stripSquare — keeps every existing pathname check working", () => {
  it("removes the prefix", () => {
    assert.equal(stripSquare("/square"), "/");
    assert.equal(stripSquare("/square/messages"), "/messages");
    assert.equal(stripSquare("/square/live/abc"), "/live/abc");
  });

  it("returns a path outside the Square unchanged", () => {
    assert.equal(stripSquare("/portfolio"), "/portfolio");
    assert.equal(stripSquare("/"), "/");
  });

  it("does not strip a lookalike", () => {
    assert.equal(stripSquare("/squared"), "/squared");
  });

  it("round-trips with sq", () => {
    for (const route of ["/", "/feed", "/messages", "/u/abc", "/live/x"]) {
      assert.equal(stripSquare(sq(route).split("?")[0]!), route);
    }
  });

  it("names the prefix once", () => {
    assert.equal(SQUARE_BASE, "/square");
  });
});
