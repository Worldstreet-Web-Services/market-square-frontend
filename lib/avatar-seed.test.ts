import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { existsSync, statSync } from "node:fs";

import {
  AVATAR_ARTWORK,
  artworkForSeed,
  hashSeed,
  initialsOf,
  resolveSeed,
  seedIndex,
} from "./avatar-seed.ts";

const PALETTE_LENGTH = AVATAR_ARTWORK.length;

describe("AVATAR_ARTWORK", () => {
  it("has a stable length — changing it re-rolls every user", () => {
    assert.equal(AVATAR_ARTWORK.length, 9);
  });

  it("has no duplicates", () => {
    assert.equal(new Set(AVATAR_ARTWORK).size, AVATAR_ARTWORK.length);
  });

  it("points at files that actually exist in public/", () => {
    for (const src of AVATAR_ARTWORK) {
      const path = `public${src}`;
      assert.ok(existsSync(path), `missing asset: ${path}`);
    }
  });

  it("keeps every asset small enough to serve as an avatar", () => {
    // These arrived as 8-33MB SVGs wrapping a 4096px raster. Guard the
    // regression: nothing in here may creep back over 100KB.
    for (const src of AVATAR_ARTWORK) {
      const bytes = statSync(`public${src}`).size;
      assert.ok(bytes > 0, `empty asset: ${src}`);
      assert.ok(bytes < 100_000, `${src} is ${(bytes / 1024).toFixed(0)}KB (max 100KB)`);
    }
  });
});

describe("artworkForSeed", () => {
  it("is stable for the same seed", () => {
    const first = artworkForSeed("did:privy:abc");
    for (let i = 0; i < 20; i++) {
      assert.equal(artworkForSeed("did:privy:abc"), first);
    }
  });

  it("returns null for an unidentified row rather than borrowing artwork", () => {
    assert.equal(artworkForSeed(""), null);
  });

  it("only ever returns artwork from the list", () => {
    for (let i = 0; i < 200; i++) {
      const src = artworkForSeed(`did:privy:user-${i}`);
      assert.ok(src !== null && AVATAR_ARTWORK.includes(src));
    }
  });

  it("survives a rename when the id is stable", () => {
    const seedBefore = resolveSeed({ id: "did:privy:x", name: "Ade" });
    const seedAfter = resolveSeed({ id: "did:privy:x", name: "Adeola the Great" });
    assert.equal(artworkForSeed(seedBefore), artworkForSeed(seedAfter));
  });
});

describe("hashSeed", () => {
  it("is stable across calls", () => {
    assert.equal(hashSeed("did:privy:abc123"), hashSeed("did:privy:abc123"));
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const seed of ["", "a", "did:privy:zzzz", "🎉", "日本語のなまえ"]) {
      const hash = hashSeed(seed);
      assert.ok(Number.isInteger(hash), `${seed} -> not an integer`);
      assert.ok(hash >= 0 && hash <= 0xffffffff, `${seed} -> out of range`);
    }
  });

  it("pins known values, so an accidental algorithm swap fails loudly", () => {
    // FNV-1a/32 reference vectors. If these change, every existing user's
    // avatar has just been re-rolled — that is the point of the test.
    assert.equal(hashSeed(""), 0x811c9dc5);
    assert.equal(hashSeed("a"), 0xe40c292c);
    assert.equal(hashSeed("foobar"), 0xbf9cf968);
  });

  it("separates similar seeds", () => {
    assert.notEqual(hashSeed("did:privy:aaaa"), hashSeed("did:privy:aaab"));
  });
});

describe("resolveSeed", () => {
  it("prefers the id over everything else", () => {
    const seed = resolveSeed({ id: "did:privy:1", username: "ade", name: "Ade" });
    assert.equal(seed, "did:privy:1");
  });

  it("falls back to username, then to name", () => {
    assert.equal(resolveSeed({ username: "ade", name: "Ade" }), "ade");
    assert.equal(resolveSeed({ name: "Ade" }), "Ade");
  });

  it("skips null, undefined and whitespace-only values", () => {
    assert.equal(resolveSeed({ id: null, username: "   ", name: "Ade" }), "Ade");
    assert.equal(resolveSeed({ id: undefined, username: undefined, name: "Ade" }), "Ade");
  });

  it("returns an empty string when nothing is identifying", () => {
    assert.equal(resolveSeed({}), "");
    assert.equal(resolveSeed({ id: null, username: null, name: null }), "");
    assert.equal(resolveSeed({ id: "  ", username: "", name: "\t" }), "");
  });

  it("trims, so padding cannot fork one person into two avatars", () => {
    assert.equal(resolveSeed({ id: "  did:privy:1  " }), "did:privy:1");
  });
});

describe("seedIndex", () => {
  it("is deterministic for the same seed", () => {
    const first = seedIndex("did:privy:abc", PALETTE_LENGTH);
    for (let i = 0; i < 50; i++) {
      assert.equal(seedIndex("did:privy:abc", PALETTE_LENGTH), first);
    }
  });

  it("always lands inside the palette", () => {
    for (let i = 0; i < 500; i++) {
      const index = seedIndex(`did:privy:user-${i}`, PALETTE_LENGTH);
      assert.ok(Number.isInteger(index));
      assert.ok(index >= 0 && index < PALETTE_LENGTH);
    }
  });

  it("spreads different seeds across every palette entry", () => {
    const counts = new Array(PALETTE_LENGTH).fill(0);
    for (let i = 0; i < 1000; i++) {
      counts[seedIndex(`did:privy:user-${i}`, PALETTE_LENGTH)] += 1;
    }
    // Every tone must be reachable, and none may swallow the population.
    // Uniform would be 200 per bucket; this is a deliberately loose band that
    // catches a degenerate hash without being flaky.
    for (const count of counts) {
      assert.ok(count > 0, `unused palette entry: ${counts.join(",")}`);
      assert.ok(count < 500, `lopsided distribution: ${counts.join(",")}`);
    }
  });

  it("pins the unknown-identity seed to index 0", () => {
    assert.equal(seedIndex("", PALETTE_LENGTH), 0);
  });

  it("rejects an empty palette rather than returning NaN", () => {
    assert.throws(() => seedIndex("x", 0), RangeError);
  });
});

describe("identity stability", () => {
  it("renaming a user does not change their avatar when the id is stable", () => {
    const before = resolveSeed({ id: "did:privy:stable", username: "ade", name: "Ade" });
    const after = resolveSeed({
      id: "did:privy:stable",
      username: "ade",
      name: "Adeola the Great",
    });
    assert.equal(before, after);
    assert.equal(
      seedIndex(before, PALETTE_LENGTH),
      seedIndex(after, PALETTE_LENGTH)
    );
  });

  it("two people sharing a display name get different avatars", () => {
    const one = resolveSeed({ id: "did:privy:one", name: "Ade" });
    const two = resolveSeed({ id: "did:privy:two", name: "Ade" });
    assert.notEqual(one, two);
  });

  it("an unnamed member seeds on id, not on the placeholder name", () => {
    // ProfileSchema turns a null displayName into "Member ·A1B2"; two such
    // members must not collide just because the fallback label is formulaic.
    const one = resolveSeed({ id: "did:privy:aaaaA1B2", name: "Member ·A1B2" });
    const two = resolveSeed({ id: "did:privy:bbbbA1B2", name: "Member ·A1B2" });
    assert.notEqual(one, two);
  });
});

describe("initialsOf", () => {
  it("takes one letter from a single word", () => {
    assert.equal(initialsOf("Ade"), "A");
  });

  it("takes first and last for multi-word names", () => {
    assert.equal(initialsOf("Ada Lovelace"), "AL");
    assert.equal(initialsOf("Ada Byron King Lovelace"), "AL");
  });

  it("collapses irregular whitespace", () => {
    assert.equal(initialsOf("  Ada   Lovelace  "), "AL");
    assert.equal(initialsOf("Ada\tLovelace"), "AL");
  });

  it("returns ? for empty and whitespace-only names", () => {
    assert.equal(initialsOf(""), "?");
    assert.equal(initialsOf("   "), "?");
    assert.equal(initialsOf("\t\n"), "?");
  });

  it("keeps an emoji whole instead of emitting half a surrogate pair", () => {
    const initials = initialsOf("🎉 party");
    assert.equal(initials.startsWith("🎉"), true);
    // A lone surrogate would render as a replacement glyph.
    assert.equal(initials.includes("�"), false);
  });

  it("handles a ZWJ emoji sequence as one grapheme", () => {
    const initials = initialsOf("👩‍💻");
    assert.equal(initials, "👩‍💻");
  });

  it("passes non-Latin scripts through without mangling them", () => {
    assert.equal(initialsOf("日本語"), "日");
    assert.equal(initialsOf("Ада Лавлейс"), "АЛ");
    assert.equal(initialsOf("محمد علي"), "مع");
  });

  it("uppercases Latin input", () => {
    assert.equal(initialsOf("ada lovelace"), "AL");
  });

  it("never returns an empty string", () => {
    for (const name of ["", " ", "​", "a", "🎉", "日本語"]) {
      assert.ok(initialsOf(name).length > 0, `empty initials for ${JSON.stringify(name)}`);
    }
  });
});
