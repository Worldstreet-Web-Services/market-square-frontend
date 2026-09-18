import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FRIENDS_FILTER,
  friendsFilterCount,
  friendsFilterFacets,
  friendsFilterLabel,
  isFriendsFilterActive,
} from "./friends-filter.ts";

test("the resting filter narrows nothing, and still leaves out people the reader follows", () => {
  assert.equal(isFriendsFilterActive(EMPTY_FRIENDS_FILTER), false);
  assert.equal(friendsFilterCount(EMPTY_FRIENDS_FILTER), 0);
  assert.equal(friendsFilterLabel(EMPTY_FRIENDS_FILTER), "Filter", "the pill names one clause of three again");
  // The deck is for making friends, so the people already followed are not
  // candidates; the SERVICE leaves them out, so the cursor pages a list that
  // never held them.
  assert.deepEqual(friendsFilterFacets(EMPTY_FRIENDS_FILTER), { excludeFollowing: true, excludeWinked: true });
});

test("one clause names its value on the pill and sends only that facet", () => {
  const city = { ...EMPTY_FRIENDS_FILTER, city: " Lagos " };
  assert.equal(friendsFilterLabel(city), "Lagos");
  assert.deepEqual(friendsFilterFacets(city), { city: "Lagos", excludeFollowing: true, excludeWinked: true });

  const gender = { ...EMPTY_FRIENDS_FILTER, gender: "Female" };
  assert.equal(friendsFilterLabel(gender), "Female");
  assert.deepEqual(friendsFilterFacets(gender), { gender: "Female", excludeFollowing: true, excludeWinked: true });

  // The deck rests on "people I don't follow yet", so that narrows nothing
  // and the service is told to leave them out; widening to everyone is the
  // clause worth naming.
  assert.equal(EMPTY_FRIENDS_FILTER.newOnly, true);
  assert.equal(isFriendsFilterActive(EMPTY_FRIENDS_FILTER), false);
  assert.deepEqual(friendsFilterFacets(EMPTY_FRIENDS_FILTER), { excludeFollowing: true, excludeWinked: true });

  const everyone = { ...EMPTY_FRIENDS_FILTER, newOnly: false };
  assert.equal(isFriendsFilterActive(everyone), true);
  assert.equal(friendsFilterLabel(everyone), "Everyone");
  assert.deepEqual(friendsFilterFacets(everyone), { excludeWinked: true });
});

test("whitespace is not a clause", () => {
  const blank = { ...EMPTY_FRIENDS_FILTER, city: "   ", gender: "\t" };
  assert.equal(isFriendsFilterActive(blank), false);
  assert.deepEqual(friendsFilterFacets(blank), { excludeFollowing: true, excludeWinked: true });
});

test("more than one clause becomes a count, because three values do not fit the pill", () => {
  const two = { city: "Lagos", gender: "Male", newOnly: true };
  assert.equal(friendsFilterCount(two), 2);
  assert.equal(friendsFilterLabel(two), "2 filters");
  assert.equal(friendsFilterLabel({ ...two, newOnly: false }), "3 filters");
});
