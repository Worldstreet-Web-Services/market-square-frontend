import assert from "node:assert/strict";
import { test } from "node:test";
import { REPLY_EXCERPT_MAX, hasQuote, mediaLabel, replyExcerpt } from "./message-reply.ts";

test("text is quoted as one line, whitespace collapsed", () => {
  assert.equal(replyExcerpt({ text: "  see you\n\n  at   nine " }), "see you at nine");
});

test("long text is cut at the service's 140 with an ellipsis", () => {
  const long = "a".repeat(200);
  const out = replyExcerpt({ text: long });
  assert.equal(out.length, REPLY_EXCERPT_MAX);
  assert.ok(out.endsWith("…"));
  // Exactly at the cap is not cut.
  assert.equal(replyExcerpt({ text: "b".repeat(140) }), "b".repeat(140));
  // A custom cap, for a narrower strip.
  assert.equal(replyExcerpt({ text: "hello world" }, 6), "hello…");
});

test("media with no caption is named by kind", () => {
  assert.equal(replyExcerpt({ text: null, media: { kind: "image" } }), "Photo");
  assert.equal(replyExcerpt({ text: "", media: { kind: "video" } }), "Video");
  assert.equal(replyExcerpt({ media: { kind: "audio" } }), "Voice note");
  // An untyped or unknown kind is still an attachment, never a blank line;
  // no media object at all is no attachment.
  assert.equal(replyExcerpt({ media: { kind: null } }), "Attachment");
  assert.equal(replyExcerpt({ media: { kind: "application/pdf" } }), "Attachment");
  assert.equal(replyExcerpt({ media: null }), "");
});

test("a caption wins over the media label", () => {
  assert.equal(replyExcerpt({ text: "look", media: { kind: "image" } }), "look");
});

test("deleted wins over everything", () => {
  assert.equal(replyExcerpt({ text: "still here", media: { kind: "image" }, deleted: true }), "Message deleted");
});

test("nothing to quote is an empty string, not a placeholder", () => {
  assert.equal(replyExcerpt({}), "");
  assert.equal(replyExcerpt({ text: "   " }), "");
  assert.equal(hasQuote({ text: "   " }), false);
  assert.equal(hasQuote(null), false);
  assert.equal(hasQuote({ media: { kind: "image" } }), true);
});

test("mediaLabel reads a MIME-ish kind too", () => {
  assert.equal(mediaLabel("image/png"), "Photo");
  assert.equal(mediaLabel("VIDEO"), "Video");
  assert.equal(mediaLabel(undefined), "Attachment");
});
