import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anchorFor,
  countNew,
  isOwnItem,
  newAuthors,
  newPostsLabel,
  splitHeld,
} from "./new-posts.ts";

const person = (id: string) => ({ id, username: id, displayName: id.toUpperCase() });
const post = (id: string, authorId: string, postId = `p-${id}`) => ({
  id,
  post: { id: postId, authorId, author: person(authorId) },
});

test("no anchor holds nothing — a fresh lane shows what the server sent", () => {
  const items = [post("a", "ada"), post("b", "bola")];
  const out = splitHeld(items, null, "me");
  assert.deepEqual(out.held, []);
  assert.deepEqual(out.shown.map((i) => i.id), ["a", "b"]);
});

test("items above the anchor are held; the anchored tail stays put", () => {
  const items = [post("n2", "chi"), post("n1", "ada"), post("a", "bola"), post("b", "dan")];
  const out = splitHeld(items, "a", "me");
  assert.deepEqual(out.held.map((i) => i.id), ["n2", "n1"]);
  assert.deepEqual(out.shown.map((i) => i.id), ["a", "b"]);
});

test("the reader's own post is never held — it shows at the head at once", () => {
  const items = [post("mine", "me"), post("n1", "ada"), post("a", "bola")];
  const out = splitHeld(items, "a", "me");
  assert.deepEqual(out.held.map((i) => i.id), ["n1"]);
  assert.deepEqual(out.shown.map((i) => i.id), ["mine", "a"]);
  assert.equal(isOwnItem(post("x", "me"), "me"), true);
  assert.equal(isOwnItem(post("x", "me"), null), false);
});

test("an anchor the server no longer returns holds nothing", () => {
  const items = [post("n1", "ada"), post("n2", "bola")];
  const out = splitHeld(items, "gone", "me");
  assert.deepEqual(out.held, []);
  assert.equal(out.shown.length, 2);
});

test("merging on tap is the server's order — the anchor moves to the head", () => {
  const items = [post("n2", "chi"), post("n1", "ada"), post("a", "bola")];
  assert.equal(anchorFor(items), "n2");
  const merged = splitHeld(items, anchorFor(items), "me");
  assert.deepEqual(merged.held, []);
  assert.deepEqual(merged.shown.map((i) => i.id), ["n2", "n1", "a"]);
});

test("a repost of a post already on the page is held but not counted", () => {
  const shown = [post("a", "bola", "P1")];
  const held = [
    { ...post("r", "chi", "P1"), repostedBy: person("chi") },
    post("n1", "ada", "P2"),
  ];
  assert.equal(countNew(held, shown), 1);
  assert.equal(countNew([], shown), 0);
});

test("the pill shows up to three distinct authors, first seen first", () => {
  const held = [post("1", "ada"), post("2", "ada"), post("3", "bola"), post("4", "chi"), post("5", "dan")];
  assert.deepEqual(
    newAuthors(held).map((a) => a.id),
    ["ada", "bola", "chi"]
  );
  assert.deepEqual(newAuthors([]), []);
});

test("singular and plural", () => {
  assert.equal(newPostsLabel(1), "1 new post");
  assert.equal(newPostsLabel(4), "4 new posts");
});

test("a reshuffle of cards the reader has already seen holds nothing and counts nothing", () => {
  const a = { id: "a", post: { id: "pa", authorId: "u1", author: person("u1") } };
  const b = { id: "b", post: { id: "pb", authorId: "u2", author: person("u2") } };
  const c = { id: "c", post: { id: "pc", authorId: "u3", author: person("u3") } };
  // The reader saw a, b, c with `a` at the head; the lane re-ranked to c, b, a.
  const seen = new Set(["a", "b", "c"]);
  const split = splitHeld([c, b, a], "a", null, seen);
  assert.deepEqual(split.held, []);
  assert.deepEqual(split.shown.map((i) => i.id), ["c", "b", "a"]);
  assert.equal(countNew(split.held, split.shown), 0);
});

test("only cards never shown are held above the anchor", () => {
  const a = { id: "a", post: { id: "pa", authorId: "u1", author: person("u1") } };
  const b = { id: "b", post: { id: "pb", authorId: "u2", author: person("u2") } };
  const fresh = { id: "n", post: { id: "pn", authorId: "u4", author: person("u4") } };
  const split = splitHeld([fresh, b, a], "a", null, new Set(["a", "b"]));
  assert.deepEqual(split.held.map((i) => i.id), ["n"]);
  assert.equal(countNew(split.held, split.shown), 1);
});
