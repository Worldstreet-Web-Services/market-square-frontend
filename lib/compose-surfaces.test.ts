import assert from "node:assert/strict";
import { test } from "node:test";
import { allowsCompose } from "./compose-surfaces.ts";

test("ordinary reading surfaces all carry a compose control", () => {
  for (const path of [
    "/",
    "/discover",
    "/messages",
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
});
