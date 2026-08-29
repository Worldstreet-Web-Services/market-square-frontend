import assert from "node:assert/strict";
import { test } from "node:test";
import { isStoryVideoMedia, storyCover } from "./story-cover.ts";

const clip = { mediaUrl: "https://cdn.test/a.mp4", mediaKind: "video/mp4" };
const photo = { mediaUrl: "https://cdn.test/b.jpg", mediaKind: "image/jpeg" };

test("a video cover is reported as one, so the tile never uses an <img>", () => {
  // The bug this exists for: a clip drawn into an <img> paints the browser's
  // broken-image glyph over a perfectly good gradient, so a story that plays
  // fine advertises itself as broken.
  assert.deepEqual(storyCover([clip]), { url: clip.mediaUrl, video: true });
});

test("a still is preferred over a clip, whatever the order", () => {
  // A photo makes a better tile than a clip's first frame, which is often
  // black, and costs one request rather than a partial video fetch.
  assert.equal(storyCover([clip, photo])?.url, photo.mediaUrl);
  assert.equal(storyCover([photo, clip])?.url, photo.mediaUrl);
  assert.equal(storyCover([clip, photo])?.video, false);
});

test("mediaKind decides, not the extension", () => {
  // A signed CDN link with no suffix would otherwise be guessed an image and
  // put straight back into the broken <img> this prevents.
  const opaque = { mediaUrl: "https://cdn.test/asset/9f8c1a?sig=abc", mediaKind: "video/mp4" };
  assert.equal(isStoryVideoMedia(opaque), true);
  assert.equal(storyCover([opaque])?.video, true);
  // And the reverse: an image the URL makes look like a clip.
  assert.equal(isStoryVideoMedia({ mediaUrl: "https://c/x.mp4", mediaKind: "image/jpeg" }), false);
});

test("the extension still decides for payloads written before mediaKind", () => {
  for (const url of ["https://c/a.mp4", "https://c/a.webm", "https://c/a.MOV", "https://c/a.mp4?x=1"]) {
    assert.equal(isStoryVideoMedia({ mediaUrl: url }), true, url);
  }
  // .mov is the case most likely to reach a tile — it is what an iPhone sends.
  assert.equal(isStoryVideoMedia({ mediaUrl: "https://c/a.mov" }), true);
  assert.equal(isStoryVideoMedia({ mediaUrl: "data:video/mp4;base64,AA" }), true);
  assert.equal(isStoryVideoMedia({ mediaUrl: "https://c/a.jpg" }), false);
});

test("a group with no media has no cover, and the gradient stands alone", () => {
  assert.equal(storyCover([]), null);
  assert.equal(storyCover(null), null);
  assert.equal(storyCover(undefined), null);
  assert.equal(storyCover([{ mediaUrl: null }, { mediaUrl: "" }]), null);
  assert.equal(isStoryVideoMedia({ mediaUrl: null }), false);
});

test("a backend-generated poster wins outright", () => {
  // One small image instead of a partial video fetch, and a frame the service
  // chose rather than whatever sits at 0.1s. Null on every story today, so
  // this is the path that improves tiles the day it starts arriving.
  const withPoster = { ...clip, thumbnailUrl: "https://cdn.test/poster.jpg" };
  assert.deepEqual(storyCover([withPoster]), {
    url: "https://cdn.test/poster.jpg",
    video: false,
  });
  // Even ahead of a still from a later story — it is the poster for the cover
  // the group actually leads with.
  assert.equal(storyCover([withPoster, photo])?.url, "https://cdn.test/poster.jpg");
});

test("an empty poster field is ignored, not used as a URL", () => {
  assert.equal(storyCover([{ ...clip, thumbnailUrl: "" }])?.url, clip.mediaUrl);
  assert.equal(storyCover([{ ...clip, thumbnailUrl: null }])?.video, true);
});
