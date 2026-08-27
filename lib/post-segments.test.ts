import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePostText, type Segment } from "./post-segments.ts";

const kinds = (segments: Segment[]) => segments.map((s) => s.kind);
const values = (segments: Segment[]) => segments.map((s) => s.value);

const mention = (handle: string, id = handle) =>
  ({ type: "profile" as const, id, label: handle, handle });

describe("links", () => {
  it("turns a URL into a link", () => {
    const [, link] = parsePostText("see https://example.com/post");
    assert.equal(link?.kind, "url");
    assert.equal(link?.kind === "url" && link.href, "https://example.com/post");
  });

  /**
   * The reason this parser validates rather than pattern-matches: the value
   * becomes an anchor href, so a loose rule publishes a script link wearing
   * the author's name to everyone who reads the post.
   */
  it("never links a script or data URL", () => {
    for (const hostile of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
    ]) {
      assert.deepEqual(kinds(parsePostText(`click ${hostile}`)), ["text"], hostile);
    }
  });

  it("leaves a scheme-less address as text rather than guessing one", () => {
    // Prefixing https:// for somebody is how you send a reader somewhere they
    // did not write.
    assert.deepEqual(kinds(parsePostText("go to www.example.com")), ["text"]);
  });

  it("does not swallow the full stop that ends the sentence", () => {
    const segments = parsePostText("read https://example.com/a.");
    const link = segments.find((s) => s.kind === "url");
    assert.equal(link?.kind === "url" && link.href, "https://example.com/a");
    assert.equal(values(segments).at(-1), ".");
  });

  it("shortens a long address for display but keeps the real one", () => {
    const long = "https://www.example.com/a/very/long/path/that/keeps/going?x=1";
    const link = parsePostText(long).find((s) => s.kind === "url");
    assert.equal(link?.kind === "url" && link.href, long);
    assert.ok(link?.kind === "url" && link.label.startsWith("example.com/"));
    assert.ok(link?.kind === "url" && link.label.length < 32);
  });
});

describe("cashtags", () => {
  it("marks up only what this app can actually trade", () => {
    // A chip that looks tappable and then apologises implies a listing that
    // does not exist.
    const segments = parsePostText("$BTC and $NOTLISTED", { tradeable: ["btc"] });
    assert.deepEqual(kinds(segments), ["cashtag", "text"]);
  });

  it("is not fooled by a price", () => {
    assert.deepEqual(kinds(parsePostText("costs US$50", { tradeable: ["50"] })), ["text"]);
  });
});

describe("hashtags", () => {
  it("links a tag and lowercases it to match the index", () => {
    const tag = parsePostText("huge for #Kospi").find((s) => s.kind === "hashtag");
    assert.equal(tag?.kind === "hashtag" && tag.tag, "kospi");
    assert.equal(tag?.kind === "hashtag" && tag.value, "#Kospi");
  });

  it("does not treat a URL fragment or an id as a tag", () => {
    // The URL wins, and #section inside it is part of the address.
    assert.deepEqual(kinds(parsePostText("see https://x.com/a#section")), ["text", "url"]);
    assert.deepEqual(kinds(parsePostText("fixed issue#42")), ["text"]);
  });

  it("refuses a numeric tag", () => {
    assert.deepEqual(kinds(parsePostText("in #2026")), ["text"]);
  });
});

describe("mentions", () => {
  it("links a handle the SERVICE recorded", () => {
    const segments = parsePostText("hey @prince", { mentions: [mention("prince", "did:1")] });
    const found = segments.find((s) => s.kind === "mention");
    assert.equal(found?.kind === "mention" && found.id, "did:1");
  });

  /**
   * This asserted the opposite and was wrong in practice: a handle typed by
   * hand stayed grey text, so the feature looked broken unless you happened to
   * use the composer's dropdown. Nobody writes a caption thinking that.
   *
   * A handle that resolves to nobody lands on the profile page's not-found
   * state, which is recoverable. Not linking at all is not.
   */
  it("links a handle even when the service did not record it", () => {
    const segments = parsePostText("hey @stranger");
    assert.deepEqual(kinds(segments), ["text", "mention"]);
    const found = segments.find((s) => s.kind === "mention");
    assert.equal(found?.kind === "mention" && found.handle, "stranger");
    // No recorded id, so the link is by handle alone.
    assert.equal(found?.kind === "mention" && found.id, null);
  });

  it("prefers the recorded id when there is one, so a rename cannot break it", () => {
    const segments = parsePostText("hey @prince", { mentions: [mention("prince", "did:1")] });
    const found = segments.find((s) => s.kind === "mention");
    assert.equal(found?.kind === "mention" && found.id, "did:1");
  });

  it("does not find a mention inside an email or a URL", () => {
    assert.deepEqual(kinds(parsePostText("mail a@b.com", { mentions: [mention("b")] })), ["text"]);
  });
});

describe("mixed text", () => {
  it("keeps everything in order and loses no characters", () => {
    const text = "hi @prince $BTC is up #kospi see https://example.com now";
    const segments = parsePostText(text, {
      tradeable: ["BTC"],
      mentions: [mention("prince")],
    });
    assert.deepEqual(kinds(segments), [
      "text", "mention", "text", "cashtag", "text", "hashtag", "text", "url", "text",
    ]);
    // Nothing dropped and nothing duplicated: the segments rebuild the input.
    assert.equal(segments.map((s) => s.value).join(""), text);
  });

  it("returns a single run for plain text, and nothing for empty", () => {
    assert.deepEqual(kinds(parsePostText("just words")), ["text"]);
    assert.deepEqual(parsePostText(""), []);
  });
});

describe("hashtag length matches the service", () => {
  // The service accepts 2-50 characters. A single-letter tag linked here would
  // be a link to a page the service refuses to answer.
  it("does not link a one-letter tag", () => {
    assert.deepEqual(kinds(parsePostText("in #a today")), ["text"]);
  });

  it("links a two-letter tag", () => {
    assert.deepEqual(kinds(parsePostText("in #ai today")), ["text", "hashtag", "text"]);
  });
});
