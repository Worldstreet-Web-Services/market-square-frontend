import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previewCaption } from "./room-preview-caption.ts";

/**
 * The room card's "Speaking Now" slot names nobody it cannot hear. Before the
 * preview connects it counts listeners; connected, it names the SFU's active
 * speaker or says nothing at all.
 */
describe("previewCaption", () => {
  it("names the active speaker once connected", () => {
    assert.deepEqual(previewCaption({ connected: true, speaker: "Ada", listening: 12 }), {
      kind: "speaking",
      text: "Ada speaking",
    });
  });

  it("says nothing in silence, even with a listener count to hand", () => {
    assert.equal(previewCaption({ connected: true, speaker: null, listening: 12 }), null);
    assert.equal(previewCaption({ connected: true, speaker: "", listening: 12 }), null);
  });

  it("counts listeners before connecting, and never guesses a speaker", () => {
    // A resolved name that arrived some other way is ignored until we can hear it.
    assert.deepEqual(previewCaption({ connected: false, speaker: "Ada", listening: 3 }), {
      kind: "listening",
      text: "3 listening",
    });
    assert.deepEqual(previewCaption({ connected: false, speaker: null, listening: 1200 }), {
      kind: "listening",
      text: "1.2K listening",
    });
  });

  it("renders nothing for a payload without a count — null is not zero", () => {
    assert.equal(previewCaption({ connected: false, speaker: null, listening: null }), null);
    assert.equal(previewCaption({ connected: false, speaker: null, listening: -1 }), null);
    assert.equal(previewCaption({ connected: false, speaker: null, listening: Number.NaN }), null);
  });

  it("still says 0 listening for a known-empty room", () => {
    assert.deepEqual(previewCaption({ connected: false, speaker: null, listening: 0 }), {
      kind: "listening",
      text: "0 listening",
    });
  });
});
