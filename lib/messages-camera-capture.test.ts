import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CAMERA_HOLD_MS,
  cameraErrorCopy,
  captureFileName,
  defaultViewOnce,
  flipFacing,
  pressIntent,
  pickClipType,
} from "../features/messages/lib/camera-capture.ts";

describe("A camera capture is view-once by default; a gallery photo is not", () => {
  it("arms itself for a photo or clip taken in a one-to-one", () => {
    assert.equal(defaultViewOnce({ source: "camera", conversationKind: "direct", mediaKind: "image" }), true);
    assert.equal(defaultViewOnce({ source: "camera", conversationKind: "direct", mediaKind: "video" }), true);
  });

  it("leaves a gallery photo alone — it was kept for a reason", () => {
    assert.equal(defaultViewOnce({ source: "upload", conversationKind: "direct", mediaKind: "image" }), false);
  });

  it("never arms a switch the service would refuse", () => {
    // A group snap would be destroyed for everybody by whoever opened it first,
    // and a view-once voice note is not a thing we have designed.
    assert.equal(defaultViewOnce({ source: "camera", conversationKind: "group", mediaKind: "image" }), false);
    assert.equal(defaultViewOnce({ source: "camera", conversationKind: "direct", mediaKind: "audio" }), false);
    assert.equal(defaultViewOnce({ source: "camera", conversationKind: "direct", mediaKind: null }), false);
  });
});

describe("The shutter reads the press as the gesture it turned out to be", () => {
  it("is a photo when it was a tap", () => {
    assert.equal(pressIntent(0), "photo");
    assert.equal(pressIntent(CAMERA_HOLD_MS - 1), "photo");
  });

  it("is a clip once the finger stayed down", () => {
    assert.equal(pressIntent(CAMERA_HOLD_MS), "clip");
    assert.equal(pressIntent(5_000), "clip");
  });
});

describe("The small decisions around a capture", () => {
  it("names the file something a disk can live with", () => {
    const at = Date.parse("2026-09-19T04:21:07.456Z");
    assert.equal(captureFileName("photo", at), "square-photo-2026-09-19T04-21-07.jpg");
    assert.equal(captureFileName("video", at), "square-clip-2026-09-19T04-21-07.webm");
  });

  it("flips between the two cameras a phone actually has", () => {
    assert.equal(flipFacing("user"), "environment");
    assert.equal(flipFacing("environment"), "user");
  });

  it("says what the reader can do about it, not what the browser called it", () => {
    assert.match(cameraErrorCopy({ name: "NotAllowedError" }), /permission/i);
    assert.match(cameraErrorCopy({ name: "NotFoundError" }), /No camera/i);
    assert.match(cameraErrorCopy({ name: "NotReadableError" }), /Another app/i);
    assert.equal(cameraErrorCopy(new Error("boom")), "Couldn't open the camera.");
    assert.equal(cameraErrorCopy(null), "Couldn't open the camera.");
  });
});

describe("Recording a clip the service will actually accept", () => {
  const ALLOWED = ["video/mp4", "video/webm"];

  it("takes the best type this browser supports AND the service allows", () => {
    assert.equal(pickClipType((type) => type.startsWith("video/webm"), ALLOWED), "video/webm;codecs=vp9,opus");
    assert.equal(pickClipType((type) => type === "video/mp4", ALLOWED), "video/mp4");
  });

  it("answers null rather than recording something that cannot be sent", () => {
    // Said BEFORE the camera opens, not after somebody has shot a clip.
    assert.equal(pickClipType(() => true, ["video/quicktime"]), null);
    assert.equal(pickClipType(() => false, ALLOWED), null);
  });
});
