import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isWelcomeSurface } from "./welcome-surface.ts";

test("the front door shows it", () => {
  assert.equal(isWelcomeSurface("/", null), true);
});

test("the sign-in page shows it — SessionGuard sends every signed-out visitor there", () => {
  // Without this the sequence is unreachable in practice: a newcomer at `/`
  // is redirected to `/auth` as soon as the first gated request 401s.
  assert.equal(isWelcomeSurface("/auth", null), true);
});

test("bounced off the FRONT DOOR is still a newcomer", () => {
  // The guard attaches `returnTo` unconditionally, so this is what a first
  // visit to `/` actually looks like by the time it reaches the sign-in page.
  // Reading "has a returnTo" as "has an account" hid the sequence entirely.
  assert.equal(isWelcomeSurface("/auth", "/"), true);
});

test("an EXPIRED session on real content does not get an introduction", () => {
  for (const from of ["/live/abc", "/p/1", "/u/ada", "/store"]) {
    assert.equal(isWelcomeSurface("/auth", from), false, from);
  }
});

test("a shared link opens the thing that was shared", () => {
  for (const path of ["/p/abc", "/u/ada", "/live/1", "/discover", "/store", "/messages"]) {
    assert.equal(isWelcomeSurface(path, null), false, path);
  }
});

test("it is the exact path, not a prefix", () => {
  // `/authors` must not be mistaken for the sign-in page.
  assert.equal(isWelcomeSurface("/authors", null), false);
  assert.equal(isWelcomeSurface("/auth/callback", null), false);
});
