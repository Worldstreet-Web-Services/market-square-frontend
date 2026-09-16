import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FALLBACK_LIMITS,
  UploadResultSchema,
  acceptFor,
  resetUploadLimits,
  setUploadLimits,
  uploadKind,
  validateUpload,
} from "./upload-rules.ts";

const PDF = { type: "application/pdf", size: 1024 };
const DOCX = {
  type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 1024,
};

describe("a document is a chat attachment and nothing else", () => {
  it("is accepted by the chat composer", () => {
    resetUploadLimits();
    assert.equal(validateUpload(PDF, "attachment"), null);
    assert.equal(validateUpload(DOCX, "attachment"), null);
  });

  it("is refused by the post composer and the avatar picker", () => {
    // There is no document in a post, a story or an avatar. A PDF there is the
    // wrong file, not a near miss, so the message names what IS accepted.
    resetUploadLimits();
    const post = validateUpload(PDF, "media");
    const avatar = validateUpload(PDF, "image");
    assert.ok(post && !post.includes("document"), post ?? "expected a rejection");
    assert.ok(avatar && avatar.includes("image"), avatar ?? "expected a rejection");
  });

  it("names documents in the chat composer's rejection copy", () => {
    resetUploadLimits();
    const message = validateUpload({ type: "application/zip", size: 10 }, "attachment");
    assert.ok(message?.includes("document"), message ?? "expected a rejection");
  });
});

describe("the file cap is its own", () => {
  it("rejects a document past maxFileBytes, naming both sizes", () => {
    resetUploadLimits();
    const tooBig = { type: "application/pdf", size: FALLBACK_LIMITS.maxFileBytes + 1 };
    const message = validateUpload(tooBig, "attachment");
    assert.ok(message?.startsWith("Files must be under"), message ?? "expected a rejection");
    assert.ok(message?.includes("10 MB"), message ?? undefined);
  });

  it("does not borrow the video cap", () => {
    // maxVideoBytes is 200 MB; a 50 MB PDF must still be refused.
    resetUploadLimits();
    assert.ok(FALLBACK_LIMITS.maxVideoBytes > FALLBACK_LIMITS.maxFileBytes);
    const message = validateUpload({ type: "application/pdf", size: 50 * 1024 * 1024 }, "attachment");
    assert.ok(message, "a 50 MB document must be refused");
  });
});

describe("uploadKind types a document as a file", () => {
  it("never calls a PDF an image", () => {
    // The old fallback returned "image" for anything unrecognised, which drew
    // an <img> around bytes no browser decodes.
    resetUploadLimits();
    assert.equal(uploadKind(PDF), "file");
    assert.equal(uploadKind(DOCX), "file");
  });

  it("still types media as before", () => {
    resetUploadLimits();
    assert.equal(uploadKind({ type: "image/png", size: 1 }), "image");
    assert.equal(uploadKind({ type: "video/mp4", size: 1 }), "video");
    assert.equal(uploadKind({ type: "audio/webm;codecs=opus", size: 1 }), "audio");
  });
});

describe("the picker only offers documents where they are accepted", () => {
  it("includes them for an attachment and excludes them everywhere else", () => {
    resetUploadLimits();
    assert.ok(acceptFor("attachment").includes("application/pdf"));
    assert.ok(!acceptFor("media").includes("application/pdf"));
    assert.ok(!acceptFor("image").includes("application/pdf"));
  });
});

describe("the contract is adopted from the service", () => {
  it("takes fileContentTypes and maxFileBytes off the wire", () => {
    resetUploadLimits();
    const adopted = setUploadLimits({
      fileContentTypes: ["application/pdf"],
      maxFileBytes: 5 * 1024 * 1024,
    });
    assert.deepEqual(adopted.fileContentTypes, ["application/pdf"]);
    assert.equal(adopted.maxFileBytes, 5 * 1024 * 1024);
    // A type the service dropped is now refused, without a release.
    assert.ok(validateUpload(DOCX, "attachment"));
    resetUploadLimits();
  });

  it("ignores an unusable payload rather than refusing every file", () => {
    resetUploadLimits();
    const adopted = setUploadLimits({ fileContentTypes: [], maxFileBytes: 0 });
    assert.deepEqual(adopted.fileContentTypes, FALLBACK_LIMITS.fileContentTypes);
    assert.equal(adopted.maxFileBytes, FALLBACK_LIMITS.maxFileBytes);
    resetUploadLimits();
  });
});

describe("the upload response may say file", () => {
  it("keeps the kind instead of catching it to null", () => {
    const parsed = UploadResultSchema.parse({
      url: "https://example.test/a.pdf",
      kind: "file",
      contentType: "application/pdf",
      bytes: 10,
    });
    assert.equal(parsed.kind, "file");
  });

  it("still degrades an unknown kind to null, never to a concrete one", () => {
    const parsed = UploadResultSchema.parse({ url: "https://example.test/a", kind: "hologram" });
    assert.equal(parsed.kind, null);
  });
});
