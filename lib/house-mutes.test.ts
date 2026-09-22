import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_MUTES,
  parseMutes,
  storageKey,
  toggleMute,
} from "../features/houses/lib/muted-for-me.ts";

describe("parseMutes", () => {
  it("reads a stored list", () => {
    assert.deepEqual([...parseMutes('["a","b"]')], ["a", "b"]);
  });

  it("treats anything unusable as NOBODY muted", () => {
    // The safe direction. A parse failure that muted people would present as
    // somebody who had simply stopped talking, which nobody would ever debug.
    for (const raw of [null, "", "{", "{}", '"a"', "7", "[1,2]"]) {
      assert.equal(parseMutes(raw).size, 0, JSON.stringify(raw));
    }
  });

  it("drops non-string entries rather than the whole set", () => {
    assert.deepEqual([...parseMutes('["a",3,null,"b"]')], ["a", "b"]);
  });
});

describe("toggleMute", () => {
  it("adds and removes without mutating the set it was given", () => {
    const before = EMPTY_MUTES;
    const muted = toggleMute(before, "ada");
    assert.equal(before.size, 0);
    assert.deepEqual([...muted], ["ada"]);
    assert.equal(toggleMute(muted, "ada").size, 0);
  });
});

describe("storageKey", () => {
  it("is scoped to one house — a silence does not follow you into the next", () => {
    assert.notEqual(storageKey("a"), storageKey("b"));
    assert.match(storageKey("a"), /^ms:house:a:/);
  });
});
