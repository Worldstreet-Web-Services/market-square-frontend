import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { firstSquareLink, parseSquareLink, shareIntoPostText } from "./square-link.ts";

describe("A Square link is read back into the thing it points at", () => {
  it("reads a post, a profile and a room", () => {
    assert.deepEqual(parseSquareLink("https://square.tsionark.com/p/034OqIADSAafQwmr157BHm"), {
      kind: "post",
      id: "034OqIADSAafQwmr157BHm",
    });
    assert.deepEqual(parseSquareLink("https://square.tsionark.com/u/prince"), {
      kind: "profile",
      id: "prince",
    });
    assert.deepEqual(parseSquareLink("https://square.tsionark.com/gist-rooms/01a0421a-fda8"), {
      kind: "room",
      id: "01a0421a-fda8",
    });
  });

  it("reads the same page inside Ark, where it wears a /square prefix", () => {
    assert.deepEqual(parseSquareLink("https://www.tsionark.com/square/p/abc"), {
      kind: "post",
      id: "abc",
    });
  });

  it("ignores the query, the hash, a port and a trailing slash", () => {
    const ref = { kind: "post", id: "abc" };
    assert.deepEqual(parseSquareLink("http://localhost:3000/p/abc?utm=x#top"), ref);
    assert.deepEqual(parseSquareLink("https://square.tsionark.com/p/abc/"), ref);
  });

  it("refuses a host that merely ENDS with ours", () => {
    // The check that this module exists to get right: a stranger's domain with
    // our name in it must never resolve as us.
    assert.equal(parseSquareLink("https://square.tsionark.com.evil.test/p/abc"), null);
    assert.equal(parseSquareLink("https://evil.test/p/abc"), null);
  });

  it("refuses anything that is not a page with a card", () => {
    assert.equal(parseSquareLink("https://square.tsionark.com/"), null);
    assert.equal(parseSquareLink("https://square.tsionark.com/feed"), null);
    assert.equal(parseSquareLink("https://square.tsionark.com/p/"), null);
    assert.equal(parseSquareLink("javascript:alert(1)"), null);
    assert.equal(parseSquareLink("not a url"), null);
  });

  it("still reads a longer path as the same thing", () => {
    assert.deepEqual(parseSquareLink("https://square.tsionark.com/p/abc/comments"), {
      kind: "post",
      id: "abc",
    });
  });
});

describe("One card per post, from the first link in it", () => {
  it("finds the link in a sentence and trims the punctuation after it", () => {
    const found = firstSquareLink("look at https://square.tsionark.com/p/abc, it's good");
    assert.equal(found?.href, "https://square.tsionark.com/p/abc");
    assert.equal(found?.ref.kind, "post");
  });

  it("takes the FIRST, because a post with four links is not four cards", () => {
    const found = firstSquareLink(
      "https://square.tsionark.com/u/ada and https://square.tsionark.com/p/abc"
    );
    assert.equal(found?.ref.id, "ada");
  });

  it("finds nothing in ordinary words or in somebody else's links", () => {
    assert.equal(firstSquareLink("just a normal post"), null);
    assert.equal(firstSquareLink("https://example.test/p/abc"), null);
    assert.equal(firstSquareLink(null), null);
  });
});

describe("Sharing into the composer", () => {
  it("prefills the link alone, with nobody else's words to delete first", () => {
    assert.equal(shareIntoPostText("  https://square.tsionark.com/p/abc "), "https://square.tsionark.com/p/abc");
  });
});
