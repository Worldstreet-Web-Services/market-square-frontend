import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupRoomCode, looksLikeRoomCode } from "./room-code.ts";

describe("the spoken room code", () => {
  it("recognises a code however a person typed it", () => {
    for (const typed of ["bcdfghjkm", "BCD-FGHJ-KM", "bcd fghj km", "  bcdfghjkm  ", "BcDfGhJkM"]) {
      assert.equal(looksLikeRoomCode(typed), true, typed);
    }
  });

  it("sends a NAME to search rather than pretending it is a code", () => {
    for (const typed of ["ogazboiz", "square talk", "", "bcdfghjk", "bcdfghjkmn"]) {
      assert.equal(looksLikeRoomCode(typed), false, typed);
    }
  });

  it("refuses the glyphs the alphabet deliberately excludes", () => {
    // Vowels (a code could spell a word) and the mishearable 0/O/1/l/I, where a
    // wrong character would resolve to the WRONG room rather than failing.
    assert.equal(looksLikeRoomCode("abcdfghjk"), false, "a vowel was accepted");
    assert.equal(looksLikeRoomCode("0cdfghjkm"), false, "a zero was accepted");
    assert.equal(looksLikeRoomCode("1cdfghjkm"), false, "a one was accepted");
    assert.equal(looksLikeRoomCode("lcdfghjkm"), false, "an l was accepted");
  });

  it("groups for the eye and leaves anything else alone", () => {
    assert.equal(groupRoomCode("bcdfghjkm"), "bcd-fghj-km");
    assert.equal(groupRoomCode("short"), "short");
    assert.equal(groupRoomCode(""), "");
  });
});
