import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_REACTION, REACTION_EMOJIS, isReactionEmoji } from "./reactions.ts";

test("the quick bar's own glyphs are all accepted", () => {
  for (const emoji of REACTION_EMOJIS) {
    assert.equal(isReactionEmoji(emoji.char), true, `${emoji.label} should pass`);
  }
  assert.equal(isReactionEmoji(DEFAULT_REACTION), true);
});

test("emoji outside the quick six still pass — the '+' sends any emoji", () => {
  assert.equal(isReactionEmoji("🔥"), true);
  assert.equal(isReactionEmoji("🚀"), true);
  assert.equal(isReactionEmoji("🥳"), true);
  // ZWJ sequences and skin-tone modifiers are one glyph, not text.
  assert.equal(isReactionEmoji("👨‍👩‍👧‍👦"), true);
  assert.equal(isReactionEmoji("👍🏾"), true);
});

test("arbitrary text can never ride the reaction channel", () => {
  assert.equal(isReactionEmoji("BUY NOW"), false);
  assert.equal(isReactionEmoji("gm"), false);
  assert.equal(isReactionEmoji("😂 lol"), false); // an emoji next to text is text
  assert.equal(isReactionEmoji("100"), false);
  assert.equal(isReactionEmoji(""), false);
  assert.equal(isReactionEmoji("a".repeat(50)), false);
});

test("non-strings are rejected outright", () => {
  assert.equal(isReactionEmoji(undefined), false);
  assert.equal(isReactionEmoji(null), false);
  assert.equal(isReactionEmoji(42), false);
  assert.equal(isReactionEmoji({}), false);
});
