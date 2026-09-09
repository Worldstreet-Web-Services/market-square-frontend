import { test } from "node:test";
import assert from "node:assert/strict";
import { isHttpUrl } from "./http-url.ts";

test("accepts http and https", () => {
  assert.equal(isHttpUrl("https://www.kwgyeke.com"), true);
  assert.equal(isHttpUrl("http://example.org/path?q=1"), true);
});

test("refuses everything that is not a web URL", () => {
  assert.equal(isHttpUrl(null), false);
  assert.equal(isHttpUrl(""), false);
  assert.equal(isHttpUrl("kwgyeke.com"), false);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("data:text/html,hi"), false);
  assert.equal(isHttpUrl("mailto:a@b.c"), false);
});
