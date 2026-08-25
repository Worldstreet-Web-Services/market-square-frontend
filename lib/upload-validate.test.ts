import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  PROXY_MAX_BYTES,
  formatBytes,
  shouldUploadDirect,
  uploadKind,
  validateUpload,
} from "./upload-rules.ts";

/**
 * The reported bug: a 7.5 MB video was refused with a bare "too large".
 *
 * Two separate faults sat behind that. Vercel rejects any request body over
 * 4.5 MB before our code runs, so the proxy could never carry it — that is
 * what PROXY_MAX_BYTES and the direct-to-storage path address. And the message
 * named no limit and no actual size, which is what these assertions pin.
 */
const file = (type: string, bytes: number) => ({ type, size: bytes });

const MB = 1024 * 1024;

describe("formatBytes", () => {
  it("reads the way a person would say it", () => {
    assert.equal(formatBytes(7.5 * MB), "7.5 MB");
    assert.equal(formatBytes(100 * MB), "100 MB");
    assert.equal(formatBytes(512 * 1024), "512 KB");
  });
});

describe("validateUpload accepts what the service accepts", () => {
  it("takes the allowed image and video types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      assert.equal(validateUpload(file(type, MB), "media"), null, type);
      assert.equal(validateUpload(file(type, MB), "image"), null, type);
    }
    for (const type of ["video/mp4", "video/webm"]) {
      assert.equal(validateUpload(file(type, 20 * MB), "media"), null, type);
    }
  });

  it("passes a 7.5 MB video — the exact file from the report", () => {
    assert.equal(
      validateUpload(file("video/mp4", 7.5 * MB), "media"),
      null,
      "7.5 MB is well under the 100 MB video cap; it must never be refused client-side"
    );
  });
});

describe("every rejection names the limit AND the real size", () => {
  it("says how big an oversized video actually is", () => {
    const message = validateUpload(file("video/mp4", 140 * MB), "media");
    assert.match(message ?? "", /100 MB/, "states the cap");
    assert.match(message ?? "", /140 MB/, "states the file's real size");
  });

  it("calls a GIF a GIF rather than 'an image'", () => {
    // GIFs blow the image cap far more often than stills, so the message has
    // to be recognisable as being about the file the reader just picked.
    const message = validateUpload(file("image/gif", 12 * MB), "media");
    assert.match(message ?? "", /GIFs/);
    assert.match(message ?? "", /10 MB/);
    assert.match(message ?? "", /12 MB/);
  });

  it("names the conversion for types the picker used to offer", () => {
    // The composer's accept attribute listed video/quicktime, which the
    // allowlist rejects — a guaranteed failure after the user had chosen.
    assert.match(validateUpload(file("video/quicktime", MB), "media") ?? "", /MP4/);
    assert.match(validateUpload(file("image/heic", MB), "media") ?? "", /JPEG/);
  });

  it("refuses a video in an image-only field without talking about size", () => {
    const message = validateUpload(file("video/mp4", MB), "image");
    assert.match(message ?? "", /image, not a video/);
  });
});

describe("the transport is chosen by SIZE, not by type", () => {
  // The constraint is a request-body limit. It does not care what the bytes
  // are, so neither may the routing rule.
  const direct = (bytes: number) => shouldUploadDirect(file("video/mp4", bytes));

  it("keeps small files on the proxy, whatever their type", () => {
    assert.equal(direct(2 * MB), false, "2 MB image");
    assert.equal(direct(PROXY_MAX_BYTES), false, "exactly at the limit stays proxied");
  });

  it("sends anything over the limit direct to storage", () => {
    assert.equal(direct(PROXY_MAX_BYTES + 1), true);
    assert.equal(direct(7.5 * MB), true, "the reported video must bypass the proxy");
  });

  it("stays under Vercel's hard 4.5 MB body limit with headroom", () => {
    assert.ok(
      PROXY_MAX_BYTES < 4.5 * MB,
      "FUNCTION_PAYLOAD_TOO_LARGE is a platform limit — the proxy cap must sit below it"
    );
    assert.ok(
      4.5 * MB - PROXY_MAX_BYTES >= 0.4 * MB,
      "multipart framing counts toward the body limit, so leave room for it"
    );
  });

  it("routes every acceptable video above the proxy cap direct", () => {
    // Otherwise the 100 MB cap we advertise is a lie on Vercel.
    for (const size of [5, 20, 60, 100]) {
      assert.equal(direct(size * MB), true, `${size} MB video`);
    }
    assert.ok(MAX_VIDEO_BYTES > PROXY_MAX_BYTES);
    assert.ok(MAX_IMAGE_BYTES > PROXY_MAX_BYTES);
  });
});

describe("uploadKind", () => {
  it("follows the allowlist, not the mime prefix", () => {
    assert.equal(uploadKind(file("video/mp4", 1)), "video");
    assert.equal(uploadKind(file("image/gif", 1)), "image");
  });
});
