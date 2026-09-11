import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FALLBACK_LIMITS, acceptFor, uploadKind, validateUpload } from "./upload-rules.ts";

describe(".mov follows the published limits", () => {
  it("offers and accepts video/quicktime only when the service lists it", () => {
    const withMov = { ...FALLBACK_LIMITS, videoContentTypes: ["video/mp4", "video/webm", "video/quicktime"] };
    const mov = { type: "video/quicktime", size: 5 * 1024 * 1024 };
    assert.ok(acceptFor("media", withMov).split(",").includes("video/quicktime"));
    assert.equal(validateUpload(mov, "media", withMov), null);
    assert.equal(uploadKind(mov, withMov), "video");
    assert.ok(!acceptFor("media", FALLBACK_LIMITS).split(",").includes("video/quicktime"));
    assert.match(validateUpload(mov, "media", FALLBACK_LIMITS) ?? "", /MOV/);
  });
});
