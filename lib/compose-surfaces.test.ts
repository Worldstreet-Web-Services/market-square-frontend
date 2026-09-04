import assert from "node:assert/strict";
import { test } from "node:test";
import { allowsCompose } from "./compose-surfaces.ts";

test("ordinary reading surfaces all carry a compose control", () => {
  for (const path of [
    "/",
    "/discover",
    "/notifications",
    "/tickets",
    "/store",
    "/store/some-item",
    "/schedule",
    "/spotlight",
    "/arkmarks",
    "/p/abc123",
    "/u/markdave",
  ]) {
    assert.equal(allowsCompose(path), true, `${path} should allow composing`);
  }
});

test("the immersive and operator surfaces suppress it", () => {
  for (const path of [
    "/live/stream-1",
    "/studio/stream-1",
    "/admin",
    "/admin/reports",
    "/operations",
    "/operations/queue",
    "/auth",
    // The chat surface draws its own `+` inside the conversation column —
    // "start a new conversation", not "write a post". The shell's viewport-edge
    // button would land over the thread pane beside the message composer.
    "/messages",
    // A gist room is the same two-pane shape as Chat, and the viewport's right
    // edge lands inside the room's chat column — directly on its composer.
    "/gist-rooms/01a069ba-e8ec-7000-bb5b-7331bce25477",
  ]) {
    assert.equal(allowsCompose(path), false, `${path} should suppress composing`);
  }
});

test("index routes are not their detail routes", () => {
  // The whole reason the rules carry a trailing slash: /studio is a list of
  // streams and /live is a directory. Only the detail views are broadcast or
  // immersive surfaces, so only they lose the control.
  assert.equal(allowsCompose("/studio"), true);
  assert.equal(allowsCompose("/live"), true);
  assert.equal(allowsCompose("/gist-rooms"), true);
  assert.equal(allowsCompose("/studio/abc"), false);
  assert.equal(allowsCompose("/live/abc"), false);
  assert.equal(allowsCompose("/gist-rooms/abc"), false);
});
