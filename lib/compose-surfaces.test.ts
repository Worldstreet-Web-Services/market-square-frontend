import assert from "node:assert/strict";
import { test } from "node:test";
import { allowsCompose, allowsRailCompose } from "./compose-surfaces.ts";

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
  assert.equal(allowsCompose("/studio/abc"), false);
  assert.equal(allowsCompose("/live/abc"), false);
  assert.equal(allowsCompose("/gist-rooms/abc"), false);
});

test("/gist-rooms keeps the +, /gist-rooms/:id does not", () => {
  /*
    THIS ASSERTION USED TO RUN THE OTHER WAY, and it was wrong.

    The index was excluded on the argument that 407:17286 draws a `+` in the
    page's own bottom-right corner which opens a ROOM, so the shell's circle
    would be a second identical button doing a different thing — "the page
    mounts its own".

    The page mounts NOTHING. `GistRoomsScreen` is the search row and
    `HousesStreet`, and that design dropped 407:17074's create button along
    with its "Happening Now!" heading and topic row. The neighbouring test in
    create-fab.test.ts even asserts the absence — it pinned BOTH halves of a
    contradiction and neither half noticed. So the collision never existed and
    the rooms list was simply the one list in the app with no way to create
    anything (ogazboiz, 2026-09-23).

    /gist-rooms/:id stays excluded by the prefix rule, for the reason it always
    had: it is a two-pane room and the viewport's right edge lands on the chat
    composer.
  */
  assert.equal(allowsCompose("/gist-rooms"), true, "the rooms index lost the dock's +");
  assert.equal(allowsCompose("/gist-rooms/abc"), false);
  // ...and the RAIL's Post gist is untouched by that: it is not this button.
  assert.equal(allowsRailCompose("/gist-rooms"), true, "the rail lost Post gist on the rooms page");
});

/*
  THE RAIL'S POST GIST IS NOT THE FLOATING BUTTON.

  It used to share `allowsCompose`, so the sidebar lost its Post gist on
  /messages, /admin and /operations. Every one of those exceptions is an
  argument about a control anchored to the RIGHT edge of the viewport — over a
  live preview, over operator rows, beside a message composer where the button
  under your hand would be the one that writes a public post. The rail's button
  is on the far left, in chrome that is already there, overlapping nothing, and
  node 496:13107 draws it unconditionally.
*/
test("the rail keeps Post gist on every surface the rail itself is on", () => {
  for (const path of ["/messages", "/admin", "/operations", "/", "/store", "/discover"]) {
    assert.equal(allowsRailCompose(path), true, `${path} lost the rail's Post gist`);
  }
});

test("the rail still has nobody to post as on /auth", () => {
  assert.equal(allowsRailCompose("/auth"), false, "/auth offers a post button");
});

test("relaxing the rail does NOT relax the floating button", () => {
  // The two predicates answer different questions; loosening one must never
  // quietly loosen the other.
  assert.equal(allowsCompose("/messages"), false, "the floating + is back on /messages");
  assert.equal(allowsCompose("/admin/reports"), false, "the floating + is back on admin");
});
