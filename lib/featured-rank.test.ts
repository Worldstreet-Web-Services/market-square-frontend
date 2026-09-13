import { test } from "node:test";
import assert from "node:assert/strict";
import { featuredLabel, parseFeaturedRank } from "./featured-rank.ts";

test("a whole number from 1 to 50 is a rank; anything else is not", () => {
  assert.equal(parseFeaturedRank("1"), 1);
  assert.equal(parseFeaturedRank(" 3 "), 3);
  assert.equal(parseFeaturedRank("50"), 50);
  assert.equal(parseFeaturedRank("0"), null);
  assert.equal(parseFeaturedRank("51"), null);
  assert.equal(parseFeaturedRank("2.5"), null);
  assert.equal(parseFeaturedRank("-1"), null);
  assert.equal(parseFeaturedRank(""), null);
  assert.equal(parseFeaturedRank("first"), null);
});

test("the label names the seat, or says there is none", () => {
  assert.equal(featuredLabel(2), "Featured #2");
  assert.equal(featuredLabel(null), "Not featured");
  assert.equal(featuredLabel(undefined), "Not featured");
});
