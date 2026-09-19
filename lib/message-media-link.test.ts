import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MEDIA_LINK_SKEW_MS, downloadLinkFor, mediaLinkExpired } from "./message-media-link.ts";

const NOW = Date.parse("2026-09-18T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("A signed attachment link is spent before its deadline, not after", () => {
  it("is good while the deadline is further off than the skew", () => {
    assert.equal(mediaLinkExpired(at(MEDIA_LINK_SKEW_MS + 1_000), NOW), false);
  });

  it("is spent once the deadline is inside the skew, so a refetch beats the 410", () => {
    assert.equal(mediaLinkExpired(at(MEDIA_LINK_SKEW_MS - 1_000), NOW), true);
    assert.equal(mediaLinkExpired(at(-1), NOW), true);
  });

  it("treats a payload with no deadline as good, because that is today's payload", () => {
    // A message from before signed links carries a storage URL that does not
    // expire. Calling it spent would hide media that renders perfectly well.
    assert.equal(mediaLinkExpired(null, NOW), false);
    assert.equal(mediaLinkExpired(undefined, NOW), false);
    assert.equal(mediaLinkExpired("", NOW), false);
  });

  it("draws a photo rather than hiding it when the deadline cannot be read", () => {
    assert.equal(mediaLinkExpired("whenever", NOW), false);
  });
});

describe("Saving a file uses the service's own download variant", () => {
  const signed = "https://api.tsionark.com/media/messages/m1?variant=download&exp=1&sig=abc";
  const cloudinary = "https://res.cloudinary.com/demo/image/upload/v1/uploads/did/image/a.jpg";

  it("prefers the signed download link, which is the only one a signature allows", () => {
    const link = downloadLinkFor({ mediaUrl: cloudinary, mediaDownloadUrl: signed }, "square-photo-1");
    assert.equal(link, signed);
  });

  it("falls back to the Cloudinary rewrite for a message sent before signed links", () => {
    const link = downloadLinkFor({ mediaUrl: cloudinary }, "square-photo-1");
    assert.equal(
      link,
      "https://res.cloudinary.com/demo/image/upload/fl_attachment:square-photo-1/v1/uploads/did/image/a.jpg"
    );
  });

  it("offers nothing rather than a link that would open the file in place", () => {
    assert.equal(downloadLinkFor({ mediaUrl: "https://elsewhere.test/a.jpg" }, "square-photo-1"), null);
    assert.equal(downloadLinkFor({ mediaUrl: null }, "square-photo-1"), null);
  });

  it("does not let a blank download field beat the fallback", () => {
    assert.equal(
      downloadLinkFor({ mediaUrl: cloudinary, mediaDownloadUrl: "  " }, "square-photo-1"),
      "https://res.cloudinary.com/demo/image/upload/fl_attachment:square-photo-1/v1/uploads/did/image/a.jpg"
    );
  });
});
