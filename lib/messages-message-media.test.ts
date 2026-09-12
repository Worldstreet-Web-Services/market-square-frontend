import assert from "node:assert/strict";
import { test } from "node:test";
import {
  flattenMessageMedia,
  formatDuration,
  mediaRatio,
  messageMediaKind,
} from "../features/messages/lib/message-media.ts";

test("the backend's own type wins, exactly as it does for a feed clip", () => {
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/x.bin", mediaKind: "image" }), "image");
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/x.bin", mediaKind: "video" }), "video");
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/x.bin", mediaKind: "audio" }), "audio");
  // Full MIME types, since the service may widen to them.
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/x", mediaKind: "audio/mpeg" }), "audio");
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/x", mediaKind: "IMAGE/PNG" }), "image");
});

test("the URL is sniffed only when the service did not type the media", () => {
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/clip.mp4" }), "video");
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/note.m4a" }), "audio");
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/note.ogg?v=2" }), "audio");
  assert.equal(messageMediaKind({ mediaUrl: "data:audio/webm;base64,AAAA" }), "audio");
  // Anything unrecognised is a picture: that is the overwhelmingly common
  // attachment, and an <img> that fails to decode degrades to a broken frame
  // rather than to a player with nothing to play.
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/photo.heic" }), "image");
  // webm belongs to video — the upload endpoint issues it for clips — so it
  // must be tested there first and never fall into the audio list.
  assert.equal(messageMediaKind({ mediaUrl: "https://cdn/clip.webm" }), "video");
});

test("an unknown kind falls through to the sniff instead of dropping the media", () => {
  assert.equal(
    messageMediaKind({ mediaUrl: "https://cdn/clip.mp4", mediaKind: "document" }),
    "video"
  );
});

test("a kind with nothing to load is no media at all", () => {
  // Rendering a photo bubble around no photo is worse than rendering the text
  // alone.
  assert.equal(messageMediaKind({ mediaUrl: null, mediaKind: "image" }), null);
  assert.equal(messageMediaKind({ mediaUrl: "   ", mediaKind: "image" }), null);
  assert.equal(messageMediaKind({}), null);
});

test("durations are mm:ss, and hours only when there are hours", () => {
  assert.equal(formatDuration(132), "02:12");
  assert.equal(formatDuration(5), "00:05");
  assert.equal(formatDuration(59.9), "00:59");
  assert.equal(formatDuration(600), "10:00");
  assert.equal(formatDuration(3725), "1:02:05");
});

test("an unmeasured file gets no duration rather than a fabricated 00:00", () => {
  assert.equal(formatDuration(null), "");
  assert.equal(formatDuration(undefined), "");
  assert.equal(formatDuration(Number.NaN), "");
  assert.equal(formatDuration(Number.POSITIVE_INFINITY), "");
  assert.equal(formatDuration(-3), "");
  // Zero IS a measurement — an empty file — and says so.
  assert.equal(formatDuration(0), "00:00");
});

test("the bubble takes the media's own ratio when both numbers arrive", () => {
  assert.equal(mediaRatio(1600, 900), 1600 / 900);
  assert.equal(mediaRatio(1080, 1350), 1080 / 1350);
});

test("a missing or absurd ratio answers null, which is what turns on the contain fallback", () => {
  assert.equal(mediaRatio(null, 900), null);
  assert.equal(mediaRatio(1600, null), null);
  assert.equal(mediaRatio(0, 900), null);
  assert.equal(mediaRatio(-1600, 900), null);
  assert.equal(mediaRatio(Number.NaN, 900), null);
  // A 1x4000 strip would produce a bubble taller than the pane.
  assert.equal(mediaRatio(1, 4000), null);
  assert.equal(mediaRatio(4000, 1), null);
});

/*
  THE WIRE SHAPE. The service sends the attachment as one nullable object; the
  pane reads five flat fields. These pin the mapping between them, because the
  mismatch shipped once and was invisible: a schema parsing five independent
  optional fields against a nested payload defaults every one of them to null,
  so nothing throws, nothing logs, and the photo simply never appears.
*/
test("a nested attachment flattens onto the message", () => {
  assert.deepEqual(
    flattenMessageMedia({
      url: "https://cdn/photo.jpg",
      kind: "image",
      width: 1200,
      height: 800,
      durationSeconds: null,
    }),
    {
      mediaUrl: "https://cdn/photo.jpg",
      mediaKind: "image",
      mediaWidth: 1200,
      mediaHeight: 800,
      mediaDurationSeconds: null,
    },
  );
});

test("no attachment is five nulls, never a partially-filled shape", () => {
  const empty = {
    mediaUrl: null,
    mediaKind: null,
    mediaWidth: null,
    mediaHeight: null,
    mediaDurationSeconds: null,
  };
  assert.deepEqual(flattenMessageMedia(null), empty);
  assert.deepEqual(flattenMessageMedia(undefined), empty);
});

test("a voice note keeps its duration and needs no dimensions", () => {
  const flat = flattenMessageMedia({ url: "https://cdn/v.mp3", kind: "audio", durationSeconds: 132 });
  assert.equal(flat.mediaKind, "audio");
  assert.equal(flat.mediaDurationSeconds, 132);
  assert.equal(flat.mediaWidth, null);
  // And the bubble picker agrees with the flattened shape, which is the whole
  // point of deriving one from the other.
  assert.equal(messageMediaKind(flat), "audio");
});

test("a URL the service could not type still reaches the sniffer, not the floor", () => {
  const flat = flattenMessageMedia({ url: "https://cdn/clip.mp4" });
  assert.equal(flat.mediaUrl, "https://cdn/clip.mp4");
  assert.equal(flat.mediaKind, null);
  // `messageMediaKind` falls back to the URL, so an untyped clip is still a
  // clip rather than a broken image.
  assert.equal(messageMediaKind(flat), "video");
});
