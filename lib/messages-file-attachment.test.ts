import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fileExtensionLabel,
  flattenMessageMedia,
  messageMediaKind,
} from "../features/messages/lib/message-media.ts";
import { buildMessagePayload } from "../features/messages/lib/outgoing.ts";

const PDF_URL = "https://cdn.test/uploads/did:privy:me/01900000-0000-7000-8000-000000000001.pdf";

describe("a document gets its own bubble, never a photo one", () => {
  it("trusts the service's own kind", () => {
    assert.equal(messageMediaKind({ mediaUrl: PDF_URL, mediaKind: "file" }), "file");
  });

  it("sniffs a document when the row carries no kind", () => {
    // Rows written before the service typed its media have a URL and nothing
    // else. Without this they fell through to the `image` fallback and drew an
    // <img> around bytes no browser decodes.
    assert.equal(messageMediaKind({ mediaUrl: PDF_URL }), "file");
    assert.equal(messageMediaKind({ mediaUrl: "https://cdn.test/a/b.docx" }), "file");
    assert.equal(messageMediaKind({ mediaUrl: "https://cdn.test/a/b.csv" }), "file");
  });

  it("leaves media alone", () => {
    assert.equal(messageMediaKind({ mediaUrl: "https://cdn.test/a.png" }), "image");
    assert.equal(messageMediaKind({ mediaUrl: "https://cdn.test/a.mp4" }), "video");
    assert.equal(messageMediaKind({ mediaUrl: "https://cdn.test/a.mp3" }), "audio");
  });

  it("is still null with no URL, whatever the kind claims", () => {
    assert.equal(messageMediaKind({ mediaUrl: null, mediaKind: "file" }), null);
  });
});

describe("fileExtensionLabel", () => {
  it("prefers the sender's name over the stored key", () => {
    assert.equal(fileExtensionLabel("Q3 report.pdf", "https://cdn.test/x/abc.bin"), "PDF");
  });

  it("falls back to the URL when there is no name", () => {
    assert.equal(fileExtensionLabel(null, PDF_URL), "PDF");
    assert.equal(fileExtensionLabel("   ", "https://cdn.test/a/b.docx"), "DOCX");
  });

  it("says FILE rather than nothing when neither knows", () => {
    assert.equal(fileExtensionLabel(null, null), "FILE");
    assert.equal(fileExtensionLabel("report", "https://cdn.test/a/b"), "FILE");
  });

  it("is not confused by a query string", () => {
    assert.equal(fileExtensionLabel(null, "https://cdn.test/a/b.pdf?sig=abc"), "PDF");
  });
});

describe("the name and size reach the bubble", () => {
  it("flattens them onto the message", () => {
    const flat = flattenMessageMedia({
      url: PDF_URL,
      kind: "file",
      fileName: "Q3 report.pdf",
      sizeBytes: 2048,
    });
    assert.equal(flat.mediaFileName, "Q3 report.pdf");
    assert.equal(flat.mediaSizeBytes, 2048);
    assert.equal(flat.mediaKind, "file");
  });

  it("gives null, not undefined, when the service sends neither", () => {
    // Null renders no size at all; `0 KB` would be a claim about a file we
    // never measured.
    const flat = flattenMessageMedia({ url: PDF_URL, kind: "file" });
    assert.equal(flat.mediaFileName, null);
    assert.equal(flat.mediaSizeBytes, null);
  });
});

describe("the outgoing payload carries a document's name and size", () => {
  it("sends both, trimmed", () => {
    const payload = buildMessagePayload({
      media: { url: PDF_URL, fileName: "  Q3 report.pdf  ", sizeBytes: 2048 },
    });
    assert.equal(payload.media?.fileName, "Q3 report.pdf");
    assert.equal(payload.media?.sizeBytes, 2048);
  });

  it("omits a name that is only whitespace", () => {
    // An empty string is not a name, and the service would reject it.
    const payload = buildMessagePayload({ media: { url: PDF_URL, fileName: "   " } });
    assert.equal(payload.media?.fileName, undefined);
  });

  it("omits both when they are absent, as a photo sends", () => {
    const payload = buildMessagePayload({ media: { url: PDF_URL, width: 10, height: 10 } });
    assert.equal(payload.media?.fileName, undefined);
    assert.equal(payload.media?.sizeBytes, undefined);
    assert.equal(payload.media?.width, 10);
  });

  it("treats a zero or negative size as unmeasured", () => {
    const zero = buildMessagePayload({ media: { url: PDF_URL, sizeBytes: 0 } });
    const negative = buildMessagePayload({ media: { url: PDF_URL, sizeBytes: -5 } });
    assert.equal(zero.media?.sizeBytes, undefined);
    assert.equal(negative.media?.sizeBytes, undefined);
  });
});
