import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addPicked,
  insertMentionAt,
  mentionTokenAt,
  mentionsPresentIn,
} from "./mention-token.ts";

test("a bare @ at the caret is a token with an empty query", () => {
  assert.deepEqual(mentionTokenAt("@", 1), { start: 0, end: 1, query: "" });
  assert.deepEqual(mentionTokenAt("hello @", 7), { start: 6, end: 7, query: "" });
});

test("the query is what follows the @, up to the caret", () => {
  assert.deepEqual(mentionTokenAt("hi @ada", 7), { start: 3, end: 7, query: "ada" });
  // Caret in the middle of the handle: only what is before it is the query.
  assert.deepEqual(mentionTokenAt("hi @adaeze", 6), { start: 3, end: 6, query: "ad" });
});

test("an @ that does not open a word is not a token", () => {
  assert.equal(mentionTokenAt("mail me@example", 15), null);
  assert.equal(mentionTokenAt("done @ada ", 10), null);
  assert.equal(mentionTokenAt("", 0), null);
});

test("a caret past the text is clamped", () => {
  assert.deepEqual(mentionTokenAt("@a", 99), { start: 0, end: 2, query: "a" });
});

test("inserting replaces the token and lands the caret after the space", () => {
  const token = mentionTokenAt("hi @ad and more", 6)!;
  const out = insertMentionAt("hi @ad and more", token, "adaeze", 100);
  assert.equal(out.text, "hi @adaeze  and more");
  assert.equal(out.caret, "hi @adaeze ".length);
});

test("inserting respects the cap and clamps the caret", () => {
  const token = mentionTokenAt("@a", 2)!;
  const out = insertMentionAt("@a", token, "verylonghandle", 6);
  assert.equal(out.text, "@veryl");
  assert.equal(out.caret, 6);
});

test("only mentions still written in the body are sent", () => {
  const picked = [
    { type: "profile", id: "1", handle: "ada" },
    { type: "profile", id: "2", handle: "bola" },
  ];
  assert.deepEqual(
    mentionsPresentIn(picked, "hey @ada, see this").map((m) => m.id),
    ["1"]
  );
  // A handle that is a prefix of another is not a match.
  assert.deepEqual(mentionsPresentIn(picked, "@adaeze").map((m) => m.id), []);
});

test("picking twice keeps one", () => {
  const one = { type: "profile", id: "1", handle: "ada" };
  const picked = addPicked(addPicked([], one), { ...one });
  assert.equal(picked.length, 1);
});
