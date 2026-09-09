import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FRIENDS_FILTER,
  friendsFilterCount,
  friendsFilterFacets,
  friendsFilterLabel,
  isFriendsFilterActive,
} from "./friends-filter.ts";

test("the empty filter is inactive, labelled by the file's word, and sends no facets", () => {
  assert.equal(isFriendsFilterActive(EMPTY_FRIENDS_FILTER), false);
  assert.equal(friendsFilterCount(EMPTY_FRIENDS_FILTER), 0);
  assert.equal(friendsFilterLabel(EMPTY_FRIENDS_FILTER), "Location");
  assert.deepEqual(friendsFilterFacets(EMPTY_FRIENDS_FILTER), {});
});

test("one clause names its value on the pill and sends only that facet", () => {
  const city = { ...EMPTY_FRIENDS_FILTER, city: " Lagos " };
  assert.equal(friendsFilterLabel(city), "Lagos");
  assert.deepEqual(friendsFilterFacets(city), { city: "Lagos" });

  const gender = { ...EMPTY_FRIENDS_FILTER, gender: "Female" };
  assert.equal(friendsFilterLabel(gender), "Female");
  assert.deepEqual(friendsFilterFacets(gender), { gender: "Female" });

  const fresh = { ...EMPTY_FRIENDS_FILTER, newOnly: true };
  assert.equal(friendsFilterLabel(fresh), "New people");
  assert.deepEqual(friendsFilterFacets(fresh), { excludeFollowing: true });
});

test("whitespace is not a clause", () => {
  const blank = { ...EMPTY_FRIENDS_FILTER, city: "   ", gender: "\t" };
  assert.equal(isFriendsFilterActive(blank), false);
  assert.deepEqual(friendsFilterFacets(blank), {});
});

test("more than one clause becomes a count, because three values do not fit the pill", () => {
  const two = { city: "Lagos", gender: "Male", newOnly: false };
  assert.equal(friendsFilterCount(two), 2);
  assert.equal(friendsFilterLabel(two), "2 filters");
  assert.equal(friendsFilterLabel({ ...two, newOnly: true }), "3 filters");
});
