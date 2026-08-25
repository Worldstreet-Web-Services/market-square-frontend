import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  invalidatePostLists,
  patchPostEverywhere,
  reconcilePost,
} from "../features/feed/lib/cache.ts";

const POST_ID = "p1";
const OTHER_ID = "p2";

function post(id: string, likeCount: number) {
  return { id, likeCount, commentCount: 0, repostCount: 0, likedByMe: false };
}

function feedPages(...ids: string[]) {
  return {
    pages: [{ items: ids.map((id) => ({ id: `f_${id}`, post: post(id, 1) })), nextCursor: null }],
    pageParams: [null],
  };
}

function seed() {
  const client = new QueryClient();
  client.setQueryData(["ms", "feed", "for-you"], feedPages(POST_ID, OTHER_ID));
  client.setQueryData(["ms", "feed", "following"], feedPages(POST_ID));
  client.setQueryData(["ms", "bookmarks"], feedPages(POST_ID));
  client.setQueryData(["ms", "profile-posts", "ada"], {
    items: [post(POST_ID, 1), post(OTHER_ID, 1)],
    nextCursor: null,
  });
  client.setQueryData(["ms", "stories"], { items: [post(POST_ID, 1)] });
  client.setQueryData(["ms", "post", POST_ID], post(POST_ID, 1));
  return client;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
const likesIn = (data: any) => data.pages[0].items.map((i: any) => i.post.likeCount);

test("a like reaches every cache the post is rendered from", () => {
  const client = seed();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
  patchPostEverywhere(client as any, POST_ID, (p) => ({ ...p, likeCount: p.likeCount + 1 }) as any);

  assert.deepEqual(likesIn(client.getQueryData(["ms", "feed", "for-you"])), [2, 1]);
  assert.deepEqual(likesIn(client.getQueryData(["ms", "feed", "following"])), [2]);
  assert.deepEqual(likesIn(client.getQueryData(["ms", "bookmarks"])), [2]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
  const profile = client.getQueryData(["ms", "profile-posts", "ada"]) as any;
  assert.deepEqual(profile.items.map((p: { likeCount: number }) => p.likeCount), [2, 1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
  assert.equal((client.getQueryData(["ms", "stories"]) as any).items[0].likeCount, 2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
  assert.equal((client.getQueryData(["ms", "post", POST_ID]) as any).likeCount, 2);
});

test("other posts are left alone", () => {
  const client = seed();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
  patchPostEverywhere(client as any, POST_ID, (p) => ({ ...p, likeCount: 99 }) as any);
  assert.deepEqual(likesIn(client.getQueryData(["ms", "feed", "for-you"])), [99, 1]);
});

test("reconcile marks every list stale without discarding its pages", () => {
  const client = seed();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
  reconcilePost(client as any, POST_ID);
  for (const key of [
    ["ms", "feed", "for-you"],
    ["ms", "bookmarks"],
    ["ms", "profile-posts", "ada"],
  ]) {
    assert.equal(client.getQueryState(key)?.isInvalidated, true, key.join("/"));
    // Scroll survives: the loaded pages are still in the cache.
    assert.ok(client.getQueryData(key), `${key.join("/")} keeps its data`);
  }
});

test("publishing invalidates every list a post can land in", () => {
  const client = seed();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures
  invalidatePostLists(client as any);
  for (const key of [
    ["ms", "feed", "for-you"],
    ["ms", "feed", "following"],
    ["ms", "bookmarks"],
    ["ms", "profile-posts", "ada"],
  ]) {
    assert.equal(client.getQueryState(key)?.isInvalidated, true, key.join("/"));
  }
});
