import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXPLORE_TABS,
  exploreTabIsRowList,
  exploreTabSearchType,
  exploreTabShowsVideos,
  exploreTabTopics,
  parseExploreTab,
} from "./explore-tabs.ts";

test("the row is exactly the designed chip set, in order", () => {
  // `Add +` is not in here on purpose: it opens the topic picker rather than
  // selecting anything, so it is not a tab.
  assert.deepEqual(EXPLORE_TABS, [
    "for-you",
    "people",
    "posts",
    "shows",
    "streams",
    "products",
  ]);
});

test("For you and Shows search EVERYTHING, never a result kind", () => {
  // Mapping these to a type would drop three quarters of the matches.
  assert.equal(exploreTabSearchType("for-you"), "all");
  assert.equal(exploreTabSearchType("shows"), "all");
});

test("the result-kind chips map straight to the service's own types", () => {
  assert.equal(exploreTabSearchType("people"), "people");
  assert.equal(exploreTabSearchType("posts"), "posts");
  assert.equal(exploreTabSearchType("streams"), "streams");
  assert.equal(exploreTabSearchType("products"), "products");
});

test("Shows is a TOPIC, not a search type", () => {
  // `shows` is in the backend's own vocabulary from GET /topics, so the chip
  // filters by it rather than inventing a fifth search type.
  assert.deepEqual(exploreTabTopics("shows"), ["shows"]);
});

test("no other chip filters by topic — interests boost, they do not filter", () => {
  // `topics=` is a hard filter upstream, and the for-you ranker already
  // applies saved interests as a +2_500 boost. Sending them here as well
  // removed every post that did not carry one, so a viewer who chose
  // interests at onboarding saw LESS of the square than one who chose none.
  assert.deepEqual(exploreTabTopics("for-you"), []);
  assert.deepEqual(exploreTabTopics("people"), []);
  assert.deepEqual(exploreTabTopics("posts"), []);
  assert.deepEqual(exploreTabTopics("streams"), []);
  assert.deepEqual(exploreTabTopics("products"), []);
});

test("row lists and the card grid are different surfaces", () => {
  // People, Posts and Products are rows from their own paged routes; the rest
  // are the media/stream grid.
  assert.equal(exploreTabIsRowList("people"), true);
  assert.equal(exploreTabIsRowList("posts"), true);
  assert.equal(exploreTabIsRowList("products"), true);
  assert.equal(exploreTabIsRowList("for-you"), false);
  assert.equal(exploreTabIsRowList("shows"), false);
  assert.equal(exploreTabIsRowList("streams"), false);
});

test("Streams browses live broadcasts only; the media tabs carry videos too", () => {
  assert.equal(exploreTabShowsVideos("streams"), false);
  assert.equal(exploreTabShowsVideos("for-you"), true);
  assert.equal(exploreTabShowsVideos("shows"), true);
});

test("an unknown tab in the URL falls back rather than blanking the page", () => {
  assert.equal(parseExploreTab(null), "for-you");
  assert.equal(parseExploreTab(""), "for-you");
  assert.equal(parseExploreTab("nonsense"), "for-you");
  assert.equal(parseExploreTab("shows"), "shows");
});
