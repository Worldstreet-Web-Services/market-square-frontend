import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mediaDownloadUrl, safeFileName } from "./media-download.ts";

const KEY = "uploads/did:privy:cmu1n88rs00fv0dky3lyzhxnz/image/01a0a16c-b39d-7000-9487-c6f96ebad1e9.jpg";
const CLOUD = "https://res.cloudinary.com/dpynyht1l";

describe("a download link for a chat attachment", () => {
  it("asks the file host for an attachment, on the plain key a message carries", () => {
    assert.equal(
      mediaDownloadUrl(`${CLOUD}/image/upload/${KEY}`, "square-photo"),
      `${CLOUD}/image/upload/fl_attachment:square-photo/${KEY}`
    );
  });

  it("works for a clip too", () => {
    const clip = "uploads/did:privy:abc/video/01a0.mp4";
    assert.equal(
      mediaDownloadUrl(`${CLOUD}/video/upload/${clip}`, "square-video"),
      `${CLOUD}/video/upload/fl_attachment:square-video/${clip}`
    );
  });

  it("drops a delivery transformation instead of prefixing it, which the host refuses", () => {
    // fl_attachment in front of f_auto,... answered 400 from the real host.
    assert.equal(
      mediaDownloadUrl(`${CLOUD}/image/upload/f_auto,q_auto,w_1280,c_limit/${KEY}`, "p"),
      `${CLOUD}/image/upload/fl_attachment:p/${KEY}`
    );
    assert.equal(
      mediaDownloadUrl(`${CLOUD}/image/upload/w_100/v1712345678/${KEY}`, "p"),
      `${CLOUD}/image/upload/fl_attachment:p/v1712345678/${KEY}`
    );
  });

  it("offers nothing for a file this service did not issue", () => {
    for (const url of [
      null,
      undefined,
      "",
      "not a url",
      `http://res.cloudinary.com/dpynyht1l/image/upload/${KEY}`,
      `https://evil.com/dpynyht1l/image/upload/${KEY}`,
      `https://res.cloudinary.com.evil.com/dpynyht1l/image/upload/${KEY}`,
      `https://res.cloudinary.com:8443/dpynyht1l/image/upload/${KEY}`,
      `${CLOUD}/image/fetch/https://evil.com/x.jpg`,
      `${CLOUD}/raw/upload/${KEY}`,
      `${CLOUD}/image/upload/my_photos/a.jpg`,
      `${CLOUD}/image/upload/uploads`,
      `${CLOUD}/image/upload/../uploads/x.jpg`,
    ]) {
      assert.equal(mediaDownloadUrl(url, "p"), null, String(url));
    }
  });
});

describe("the saved file's name", () => {
  it("keeps only what the flag accepts", () => {
    assert.equal(safeFileName("Amara Okafor's photo"), "Amara-Okafor-s-photo");
    assert.equal(safeFileName("../../etc/passwd"), "etc-passwd");
    assert.equal(safeFileName("a,b:c/d.e"), "a-b-c-d-e");
  });

  it("never comes back empty", () => {
    assert.equal(safeFileName("!!!"), "square-media");
    assert.equal(safeFileName(""), "square-media");
  });
});
