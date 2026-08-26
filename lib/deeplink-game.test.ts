import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gameLabel, isArkOriginated, parseGameRef, resolveDeepLink } from "./deeplink.ts";

/**
 * Ark broadcasts its casino games to Market Square as live streams. The game
 * itself lives in Ark, so `{ kind: "game", ref: "<game>:<id>" }` is the way
 * back — without it those streams are dead ends.
 *
 * `resolveDeepLink` returns `available: false` for Ark destinations while
 * NEXT_PUBLIC_ARK_APP_URL is unset, which it is under test. The PATH is still
 * built, so these assert on the path and treat availability separately.
 */
const game = (ref: string) => resolveDeepLink({ kind: "game", ref });

describe("parseGameRef splits on the FIRST colon only", () => {
  it("separates prefix from id", () => {
    assert.deepEqual(parseGameRef("chess:abc123"), { game: "chess", id: "abc123" });
  });

  it("keeps colons that belong to the id", () => {
    // Ark ids are not guaranteed colon-free; splitting on every colon would
    // silently truncate them and route to the wrong match.
    assert.deepEqual(parseGameRef("chess:match:2026:07"), {
      game: "chess",
      id: "match:2026:07",
    });
  });

  it("treats a bare ref as chess", () => {
    // Chess shipped first: streams carrying a bare match id already exist
    // upstream, and would otherwise lose their link home.
    assert.deepEqual(parseGameRef("abc123"), { game: "chess", id: "abc123" });
  });
});

describe("each game routes to its own Ark surface", () => {
  it("sends chess spectators to /watch, not /play", () => {
    // /play is for the two participants; a Market Square viewer is neither.
    assert.match(game("chess:m1").href, /\/casino\/chess\/watch\?match=m1$/);
  });

  it("sends checkers to /play", () => {
    assert.match(game("checkers:m2").href, /\/casino\/checkers\/play\?match=m2$/);
  });

  it("sends arkball to the draw page, with no id", () => {
    // A draw is global — the route carries no id at all.
    assert.match(game("arkball:draw-9").href, /\/casino\/arkball$/);
  });

  it("sends last-standing to a path segment", () => {
    assert.match(game("last-standing:g7").href, /\/casino\/last-standing\/g7$/);
  });

  it("routes a legacy bare id as a chess match", () => {
    assert.match(game("abc123").href, /\/casino\/chess\/watch\?match=abc123$/);
  });

  it("url-encodes ids so a colon-bearing id survives the query string", () => {
    assert.match(game("chess:a b:c").href, /match=a%20b%3Ac$/);
  });
});

describe("unknown games degrade instead of guessing", () => {
  it("offers no link for a game this build does not know", () => {
    // A wrong route into Ark is worse than no route; the stream description
    // carries a plain absolute URL as the reader's fallback.
    const resolved = game("roulette:r1");
    assert.equal(resolved.available, false);
    assert.equal(resolved.href, "");
  });

  it("offers no link when a required id is missing", () => {
    assert.equal(game("chess:").available, false);
    assert.equal(game("last-standing:").available, false);
  });

  it("still resolves arkball with no id, because it needs none", () => {
    assert.match(game("arkball:").href, /\/casino\/arkball$/);
  });

  it("never throws on malformed input", () => {
    for (const ref of ["", ":", "::", "   ", ":onlyid"]) {
      assert.doesNotThrow(() => game(ref), `ref ${JSON.stringify(ref)}`);
    }
  });
});

describe("gameLabel names the game for the card", () => {
  it("labels each known prefix", () => {
    assert.equal(gameLabel({ kind: "game", ref: "chess:1" }), "Chess");
    assert.equal(gameLabel({ kind: "game", ref: "checkers:1" }), "Checkers");
    assert.equal(gameLabel({ kind: "game", ref: "arkball:1" }), "Arkball");
    assert.equal(gameLabel({ kind: "game", ref: "last-standing:1" }), "Last Standing");
    assert.equal(gameLabel({ kind: "game", ref: "bare-id" }), "Chess");
  });

  it("labels nothing for a non-game link or an unknown game", () => {
    assert.equal(gameLabel({ kind: "stream", ref: "s1" }), null);
    assert.equal(gameLabel({ kind: "game", ref: "roulette:1" }), null);
    assert.equal(gameLabel(null), null);
  });
});

describe("an Ark-originated stream is watch-only in Market Square", () => {
  it("recognises a stream that originates in another Ark product", () => {
    // Keyed on `kind`, so a future Ark surface behaves correctly by adding a
    // kind rather than by editing the stream room.
    assert.equal(isArkOriginated({ kind: "game", ref: "chess:1" }), true);
    assert.equal(isArkOriginated({ kind: "listing", ref: "l1" }), true);
    assert.equal(isArkOriginated({ kind: "market", ref: "m1" }), true);
  });

  it("leaves native Market Square streams alone", () => {
    // These keep the speaker-request flow exactly as it was.
    assert.equal(isArkOriginated(null), false);
    assert.equal(isArkOriginated(undefined), false);
    assert.equal(isArkOriginated({ kind: "stream", ref: "s1" }), false);
    assert.equal(isArkOriginated({ kind: "store_item", ref: "remit" }), false);
    // An author-supplied URL on a native stream must NOT make it watch-only.
    assert.equal(isArkOriginated({ kind: "external", ref: "https://example.com" }), false);
  });

  it("does not depend on the game vocabulary", () => {
    // A game we do not know how to route is still an Ark broadcast: the
    // speaker control must stay hidden even though the CTA cannot resolve.
    assert.equal(isArkOriginated({ kind: "game", ref: "roulette:1" }), true);
    assert.equal(resolveDeepLink({ kind: "game", ref: "roulette:1" }).available, false);
  });
});
