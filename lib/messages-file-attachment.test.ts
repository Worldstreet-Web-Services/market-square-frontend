import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mediaDownloadUrl } from "./media-download.ts";
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

/**
 * A SOURCE ASSERTION, for the half that has no pure form.
 *
 * `bubbleShell` paints MY bubble white and THEIRS `--color-spotlight`, so any
 * ink inside a bubble has to be paired to the shell it sits on. `FileBubble`
 * shipped with a hardcoded `text-white`, which made a document sent by the
 * reader render as an empty white box — stored correctly, sent correctly, and
 * invisible. No unit test could catch that because the values are class names
 * in JSX, so the file itself is what gets checked, exactly as
 * `shell-invariants` and `story-sound` do for their own wiring.
 */
describe("the file bubble is readable on BOTH bubble shells", () => {
  const source = readFileSync(
    new URL("../features/messages/components/thread.tsx", import.meta.url),
    "utf8"
  );
  const body = source.slice(
    source.indexOf("function FileBubble("),
    source.indexOf("function MediaBubble(")
  );

  it("was found at all, so this test cannot silently pass on a rename", () => {
    assert.ok(body.length > 500, "FileBubble's body was not located in thread.tsx");
  });

  it("pairs its surfaces and ink to `mine`", () => {
    // The row, the type chip, the name, the size and the download control —
    // five decisions, none of which may assume one background.
    const ternaries = body.match(/\bmine\b\s*\?/g) ?? [];
    assert.ok(
      ternaries.length >= 4,
      `expected the ink to branch on \`mine\`, found ${ternaries.length}`
    );
  });

  it("carries a LIGHT-shell branch, whose absence was the original bug", () => {
    // Checking for the branch that must exist beats hunting for white strings:
    // `text-white` is perfectly correct on the purple shell, and a matcher that
    // flags it produces a test that fails on working code. What could never be
    // right is styling this bubble with no dark ink at all — that is precisely
    // what rendered the reader's own document as an empty white box.
    assert.ok(body.includes("bg-black/"), "no dark surface for the white bubble");
    assert.ok(body.includes("text-black/"), "no dark ink for the white bubble");
  });
});

/**
 * A DOCUMENT MUST BE REACHABLE, not merely visible.
 *
 * `FileBubble` once ran the document's URL through `mediaDownloadUrl`, the
 * helper that makes Cloudinary serve a PICTURE or CLIP as an attachment. It
 * only accepts `https://res.cloudinary.com/…/(image|video)/upload/…`, so for a
 * document it answered null — and null drew no control while the row itself
 * was inert. The file was stored, sent and rendered, and could not be opened.
 */
describe("a document can be opened", () => {
  it("the picture/clip helper genuinely cannot serve a document on either store", () => {
    // Pinning the PREMISE, so this is not rediscovered by breaking it again.
    // Cloudinary stores a document as `raw`, outside the helper's pattern...
    assert.equal(
      mediaDownloadUrl(
        "https://res.cloudinary.com/demo/raw/upload/fl_attachment/uploads/did:privy:me/file/a.docx",
        "a"
      ),
      null
    );
    // ...and locally it lives on MinIO over http, which the helper refuses.
    assert.equal(
      mediaDownloadUrl("http://localhost:9004/market-square-media/uploads/did:privy:me/file/a.docx", "a"),
      null
    );
  });

  it("links the document's own url, guarded, with the whole row as the target", () => {
    const source = readFileSync(
      new URL("../features/messages/components/thread.tsx", import.meta.url),
      "utf8"
    );
    const body = source
      .slice(source.indexOf("function FileBubble("), source.indexOf("function MediaBubble("))
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    assert.ok(!body.includes("mediaDownloadUrl("), "a document must not go through the picture/clip helper");
    assert.ok(/isHttpUrl\(url\)/.test(body), "the href must be guarded to http(s)");
    assert.ok(body.includes("href={href}"), "the row must link the document");
  });
});
