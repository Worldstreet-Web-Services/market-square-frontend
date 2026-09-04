import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UploadResultSchema } from "./upload-rules.ts";

/**
 * THE BUG: `kind` was `z.enum(["image", "video"]).catch("image")`.
 *
 * Audio shipped on the service, the service correctly answered
 * `kind: "audio"`, the enum did not know that value, and `.catch("image")`
 * swallowed the failure and returned "image". Every recorded voice note came
 * back typed as a picture, the composer rendered `<img src="....weba">`, and
 * the user saw a broken image with no error anywhere to explain it.
 *
 * A silent `.catch` to a CONCRETE value is the mechanism here: it does not
 * degrade, it asserts something specific and wrong. Unknown must stay unknown.
 */
describe("UploadResultSchema.kind", () => {
  const base = { url: "https://cdn.test/uploads/u1/x.weba", contentType: "audio/webm", bytes: 1 };

  it("keeps audio as audio", () => {
    assert.equal(UploadResultSchema.parse({ ...base, kind: "audio" }).kind, "audio");
  });

  it("keeps image and video as themselves", () => {
    assert.equal(UploadResultSchema.parse({ ...base, kind: "image" }).kind, "image");
    assert.equal(UploadResultSchema.parse({ ...base, kind: "video" }).kind, "video");
  });

  it("degrades an unknown kind to null, never to a confident 'image'", () => {
    // The next kind the service adds must not be rendered as a picture.
    assert.equal(UploadResultSchema.parse({ ...base, kind: "model/gltf" }).kind, null);
    assert.equal(UploadResultSchema.parse({ ...base, kind: undefined }).kind, null);
  });

  it("still parses the rest of the payload when the kind is unknown", () => {
    // Degrading must not throw away the URL — the upload DID succeed.
    const result = UploadResultSchema.parse({ ...base, kind: "future" });
    assert.equal(result.url, base.url);
    assert.equal(result.bytes, 1);
  });
});
