import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyCommentLike,
  expanderLabel,
  groupThread,
  patchCommentIn,
  replyParentOf,
  replyPrefill,
  type ThreadComment,
} from "./comment-thread.ts";

const at = (iso: string, id: string, parentId: string | null = null): ThreadComment => ({
  id,
  parentId,
  createdAt: iso,
  replyCount: 0,
  likeCount: 0,
  likedByMe: false,
});

test("a like adds one and marks it; an unlike takes it back", () => {
  const plain = { ...at("2026-09-09T00:00:00Z", "c1"), likeCount: 4 };
  const liked = applyCommentLike(plain, true);
  assert.equal(liked.likeCount, 5);
  assert.equal(liked.likedByMe, true);
  const back = applyCommentLike(liked, false);
  assert.equal(back.likeCount, 4);
  assert.equal(back.likedByMe, false);
});

test("liking twice counts once, and an unlike never goes below zero", () => {
  const liked = { ...at("2026-09-09T00:00:00Z", "c1"), likeCount: 1, likedByMe: true };
  assert.equal(applyCommentLike(liked, true), liked);
  const lagging = { ...at("2026-09-09T00:00:00Z", "c2"), likeCount: 0, likedByMe: true };
  assert.equal(applyCommentLike(lagging, false).likeCount, 0);
});

test("a reply to a reply files under the top-level comment", () => {
  assert.equal(replyParentOf({ id: "top", parentId: null }), "top");
  assert.equal(replyParentOf({ id: "reply", parentId: "top" }), "top");
});

test("the reply prefill is the handle and a space, or nothing", () => {
  assert.equal(replyPrefill("ada"), "@ada ");
  assert.equal(replyPrefill("  ada "), "@ada ");
  assert.equal(replyPrefill(null), "");
  assert.equal(replyPrefill(""), "");
});

test("top-level newest first, replies oldest first", () => {
  const items = [
    at("2026-09-09T10:00:00Z", "a"),
    at("2026-09-09T12:00:00Z", "b"),
    at("2026-09-09T11:30:00Z", "a2", "a"),
    at("2026-09-09T11:00:00Z", "a1", "a"),
  ];
  const threads = groupThread(items);
  assert.deepEqual(
    threads.map((thread) => thread.comment.id),
    ["b", "a"]
  );
  assert.deepEqual(
    threads[1]!.replies.map((reply) => reply.id),
    ["a1", "a2"]
  );
});

test("a reply whose parent is not on the page keeps its words as a top-level entry", () => {
  const orphan = at("2026-09-09T10:00:00Z", "r", "gone");
  const threads = groupThread([orphan]);
  assert.equal(threads.length, 1);
  assert.equal(threads[0]!.comment.id, "r");
});

test("patching returns the same page when nothing matched", () => {
  const items = [at("2026-09-09T10:00:00Z", "a")];
  assert.equal(patchCommentIn(items, "zzz", (c) => ({ ...c, likeCount: 9 })), items);
  const next = patchCommentIn(items, "a", (c) => ({ ...c, likeCount: 9 }));
  assert.notEqual(next, items);
  assert.equal(next[0]!.likeCount, 9);
});

test("the expander says how many MORE there are, and hides when open", () => {
  assert.equal(expanderLabel(0, 0, false), null);
  assert.equal(expanderLabel(1, 0, false), "View 1 reply");
  assert.equal(expanderLabel(3, 0, false), "View 3 replies");
  assert.equal(expanderLabel(3, 1, false), "View 2 more replies");
  assert.equal(expanderLabel(3, 3, false), null);
  assert.equal(expanderLabel(3, 3, true), "Hide replies");
  assert.equal(expanderLabel(3, 0, true), null);
});
