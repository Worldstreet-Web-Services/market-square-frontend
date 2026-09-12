import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_POST_MEDIA,
  attachmentKind,
  carriesMediaList,
  checkMediaSelection,
  mediaFields,
  postMediaList,
  railDotWidth,
  railIndexAt,
} from "./post-media.ts";

describe("a post's media list", () => {
  it("reads the served list in order, and an older payload's one mediaUrl as a list of one", () => {
    const media = [
      { url: "a.jpg", kind: "image" },
      { url: "b.jpg", kind: "image" },
    ];
    assert.deepEqual(postMediaList({ media, mediaUrl: "a.jpg" }), media);
    assert.deepEqual(postMediaList({ mediaUrl: "c.mp4", mediaKind: "video", thumbnailUrl: "c.jpg" }), [
      { url: "c.mp4", kind: "video", thumbnailUrl: "c.jpg" },
    ]);
    assert.deepEqual(postMediaList({ media: [], mediaUrl: null }), []);
    assert.deepEqual(postMediaList({ mediaUrl: null }), []);
  });

  it("treats the media KEY as the server's answer: present (even empty) means lists are taken", () => {
    assert.equal(carriesMediaList([{ media: [] }]), true);
    assert.equal(carriesMediaList([null, { media: [{ url: "a", kind: "image" }] }]), true);
    assert.equal(carriesMediaList([{}, { media: undefined }, null]), false);
    assert.equal(carriesMediaList([]), false);
  });
});

describe("what the composer sends", () => {
  it("keeps mediaUrl for one item and sends media only for two or more, never both", () => {
    assert.deepEqual(mediaFields([]), {});
    assert.deepEqual(mediaFields([{ url: "a", kind: "video" }]), { mediaUrl: "a" });
    assert.deepEqual(
      mediaFields([
        { url: "a", kind: "image" },
        { url: "b", kind: "image" },
      ]),
      { media: [{ url: "a", kind: "image" }, { url: "b", kind: "image" }] }
    );
  });

  it("types an attachment by the service's answer first, the picked file second", () => {
    assert.equal(attachmentKind("video", "image"), "video");
    assert.equal(attachmentKind(null, "video"), "video");
    assert.equal(attachmentKind(null, null), "image");
  });

  it("refuses what the service refuses, in its words", () => {
    const opts = { story: false, max: MAX_POST_MEDIA };
    assert.equal(MAX_POST_MEDIA, 10);
    assert.equal(checkMediaSelection(["video"], opts), null);
    assert.equal(checkMediaSelection(["image", "image"], opts), null);
    assert.equal(checkMediaSelection(["image", "video"], opts), "A post with more than one item carries photos only.");
    assert.equal(checkMediaSelection(Array(11).fill("image"), opts), "Up to 10 photos in one post.");
    assert.equal(checkMediaSelection(["image", "image"], { story: true, max: 10 }), "A story carries one photo or video.");
  });
});

describe("the rail — node 1029:22591", () => {
  it("draws the current dot 31.17, the next 11.85 and the rest 10.60", () => {
    assert.deepEqual([0, 1, 2, 3].map((index) => railDotWidth(index, 0)), [31.17, 11.85, 10.6, 10.6]);
    assert.deepEqual([0, 1, 2, 3].map((index) => railDotWidth(index, 3)), [10.6, 10.6, 10.6, 31.17]);
  });

  it("follows the scroll by whole tiles and lands on the last tile at the far end", () => {
    const step = 250.93 + 10.36;
    assert.equal(railIndexAt(0, 500, 4), 0);
    assert.equal(railIndexAt(step * 1.4, 900, 4), 1);
    assert.equal(railIndexAt(step * 1.6, 900, 4), 2);
    assert.equal(railIndexAt(499.5, 500, 4), 3);
    assert.equal(railIndexAt(99999, 0, 4), 3);
    assert.equal(railIndexAt(0, 0, 0), 0);
  });
});
