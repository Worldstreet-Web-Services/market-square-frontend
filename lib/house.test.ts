import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOUSE_CATEGORY,
  NOTE_MAX,
  TOPIC_MAX,
  TOPIC_MIN,
  clampNote,
  clampTopic,
  houseShareUrl,
  housePath,
  houseTopic,
  isHouse,
  isValidTopic,
} from "../features/houses/lib/house.ts";

describe("isHouse", () => {
  it("matches the category exactly", () => {
    assert.equal(isHouse({ category: HOUSE_CATEGORY }), true);
  });

  it("is never a substring match", () => {
    // `category.includes("house")` would claim a future "housemusic" stream,
    // and the failure mode is a VIDEO stream opening in a room that has no
    // video code path at all.
    assert.equal(isHouse({ category: "housemusic" }), false);
    assert.equal(isHouse({ category: "openhouse" }), false);
    assert.equal(isHouse({ category: "House" }), false);
  });

  it("rejects every broadcast category", () => {
    for (const category of ["worldstreet", "music", "podcast", "gaming", "other"]) {
      assert.equal(isHouse({ category }), false);
    }
  });
});

describe("topic", () => {
  it("is the stream title, trimmed", () => {
    assert.equal(houseTopic({ title: "  Sunday standup  " }), "Sunday standup");
  });

  it("caps typed input rather than letting the service refuse it", () => {
    assert.equal(clampTopic("x".repeat(400)).length, TOPIC_MAX);
    assert.equal(clampTopic("short"), "short");
  });

  it("accepts one character and refuses whitespace alone", () => {
    assert.equal(TOPIC_MIN, 1);
    assert.equal(isValidTopic("a"), true);
    assert.equal(isValidTopic("   "), false);
    assert.equal(isValidTopic(""), false);
  });

  it("accepts a topic at the cap and refuses one past it", () => {
    assert.equal(isValidTopic("x".repeat(TOPIC_MAX)), true);
    assert.equal(isValidTopic("x".repeat(TOPIC_MAX + 1)), false);
  });
});

describe("pinned note", () => {
  it("is capped far below the backend's 2000 — a note that scrolls is a document", () => {
    assert.ok(NOTE_MAX <= 140);
    assert.equal(clampNote("x".repeat(500)).length, NOTE_MAX);
  });
});

describe("links", () => {
  it("builds the listener link", () => {
    assert.equal(housePath("abc"), "/houses/abc");
    assert.equal(houseShareUrl("https://ark.test", "abc"), "https://ark.test/houses/abc");
  });

  it("builds the speaker link, which raises a hand and is NOT pre-approval", () => {
    assert.equal(houseShareUrl("https://ark.test", "abc", true), "https://ark.test/houses/abc?seat=1");
  });
});
