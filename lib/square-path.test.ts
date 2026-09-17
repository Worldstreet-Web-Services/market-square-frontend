import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBase, sq, squarePaths } from "./square-path.ts";

const mounted = squarePaths("/square");
const standalone = squarePaths("");

describe("the standalone build changes nothing", () => {
  it("returns every path as it was", () => {
    for (const path of ["/", "/feed", "/u/did:privy:abc", "/messages?c=01a0", "/?compose=1&link=stream:abc"]) {
      assert.equal(standalone.sq(path), path);
      assert.equal(standalone.stripSquare(path), path);
    }
    assert.equal(standalone.asset("/logo.svg"), "/logo.svg");
    assert.equal(standalone.api("/api/kash"), "/api/kash");
  });

  it("does not treat a real /square route as a prefix to strip", () => {
    assert.equal(standalone.stripSquare("/square/feed"), "/square/feed");
  });

  it("is what the test runner gets, since no base is set here", () => {
    assert.equal(sq("/feed"), "/feed");
  });
});

describe("sq — a route in the build Ark mounts", () => {
  it("prefixes a route", () => {
    assert.equal(mounted.sq("/feed"), "/square/feed");
    assert.equal(mounted.sq("/u/did:privy:abc"), "/square/u/did:privy:abc");
    assert.equal(mounted.sq("/messages?c=01a0"), "/square/messages?c=01a0");
  });

  it("maps the front page to /square, never /square/", () => {
    assert.equal(mounted.sq("/"), "/square");
  });

  it("keeps the cross-product share contract working from the root", () => {
    assert.equal(mounted.sq("/?compose=1&link=stream:abc"), "/square?compose=1&link=stream:abc");
    assert.equal(mounted.sq("/#top"), "/square#top");
  });

  it("is idempotent", () => {
    assert.equal(mounted.sq(mounted.sq("/feed")), "/square/feed");
    assert.equal(mounted.sq("/square"), "/square");
    assert.equal(mounted.sq("/square?x=1"), "/square?x=1");
  });

  it("leaves foreign addresses alone", () => {
    assert.equal(mounted.sq("https://www.tsionark.com/portfolio"), "https://www.tsionark.com/portfolio");
    assert.equal(mounted.sq("//cdn.example.com/a"), "//cdn.example.com/a");
    assert.equal(mounted.sq("#comments"), "#comments");
    assert.equal(mounted.sq("?tab=2"), "?tab=2");
    assert.equal(mounted.sq(""), "");
  });

  it("does not treat a lookalike prefix as ours", () => {
    assert.equal(mounted.sq("/squared"), "/square/squared");
  });
});

describe("asset and api in the build Ark mounts", () => {
  it("prefix a public file and a BFF endpoint", () => {
    assert.equal(mounted.asset("/logo.svg"), "/square/logo.svg");
    assert.equal(mounted.asset("/notifications/notif-mention.svg"), "/square/notifications/notif-mention.svg");
    assert.equal(mounted.api("/api/kash"), "/square/api/kash");
  });

  it("are idempotent and leave foreign addresses alone", () => {
    assert.equal(mounted.asset(mounted.asset("/sw.js")), "/square/sw.js");
    assert.equal(mounted.asset("https://res.cloudinary.com/x.png"), "https://res.cloudinary.com/x.png");
    assert.equal(mounted.api("https://ark.example/api/square/symbols"), "https://ark.example/api/square/symbols");
  });
});

describe("stripSquare in the build Ark mounts", () => {
  it("removes the prefix", () => {
    assert.equal(mounted.stripSquare("/square"), "/");
    assert.equal(mounted.stripSquare("/square/messages"), "/messages");
  });

  it("returns an unprefixed path unchanged, so a server render of the rewritten route agrees", () => {
    assert.equal(mounted.stripSquare("/messages"), "/messages");
    assert.equal(mounted.stripSquare("/"), "/");
  });

  it("does not strip a lookalike", () => {
    assert.equal(mounted.stripSquare("/squared"), "/squared");
  });

  it("round-trips with sq", () => {
    for (const route of ["/", "/feed", "/messages", "/u/abc", "/live/x"]) {
      assert.equal(mounted.stripSquare(mounted.sq(route).split("?")[0]!), route);
    }
  });
});

describe("the base is one of two values", () => {
  it("accepts unset and /square", () => {
    assert.equal(parseBase(undefined), "");
    assert.equal(parseBase(""), "");
    assert.equal(parseBase("/square"), "/square");
  });

  it("refuses anything else, so a typo fails the build instead of shipping broken links", () => {
    assert.throws(() => parseBase("/square/"));
    assert.throws(() => parseBase("square"));
    assert.throws(() => parseBase("/market"));
  });
});
