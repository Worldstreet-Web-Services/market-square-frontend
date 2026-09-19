/**
 * WHAT A CAMERA CAPTURE IS, decided without a browser in the room.
 *
 * The camera itself is all side effects — permissions, a live track, a codec
 * the browser may or may not have — so the RULES live here, pure and pinned,
 * and `use-camera.ts` does the talking to the device.
 *
 * ─── WHY THE SOURCE IS REMEMBERED ────────────────────────────────────────────
 * A photo taken in the app and a photo chosen from a gallery are the same
 * bytes and a different intention. Snapchat's whole grammar rests on that: the
 * camera is for the moment you are in, the gallery is for something you kept.
 * So a capture arrives marked `camera`, and that is what arms View once by
 * default — the sender can still turn it off, and a gallery photo can still be
 * turned on. The mark decides the DEFAULT, never the permission.
 *
 * Pure, so `lib/messages-camera-capture.test.ts` pins it.
 */

import { normalizeType } from "../../../lib/upload-rules.ts";

/** Where the bytes came from. */
export type MediaSource = "camera" | "upload";

/** Longest clip the camera will record, in milliseconds. */
export const CAMERA_MAX_CLIP_MS = 30_000;

/** How long a press has to last before it starts recording rather than taking a photo. */
export const CAMERA_HOLD_MS = 400;

/**
 * Is this attachment view-once BEFORE the sender has touched the switch?
 *
 * Camera captures in a one-to-one are, because that is what taking a picture
 * inside a chat means. Everything else is not: a photo out of a gallery was
 * kept for a reason, and a thing the sender kept is not a thing to destroy on
 * their behalf.
 *
 * Returns false wherever a snap could not be sent at all, so the default can
 * never arm a switch the service would refuse.
 */
export function defaultViewOnce(input: {
  source: MediaSource;
  conversationKind: "direct" | "group" | string;
  mediaKind: string | null | undefined;
}): boolean {
  if (input.source !== "camera") return false;
  if (input.conversationKind !== "direct") return false;
  return input.mediaKind === "image" || input.mediaKind === "video";
}

/**
 * Clip codecs, best first.
 *
 * `MediaRecorder` records what the BROWSER has, not what we ask for, and the
 * service allowlists `video/mp4` and `video/webm` only. The same pairing the
 * voice recorder does, for the same reason: a clip recorded in a type the
 * service refuses is a clip somebody shot and cannot send.
 */
export const CLIP_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
] as const;

/** The type to record a clip in, or null when this browser can produce none the service takes. */
export function pickClipType(
  isSupported: (mimeType: string) => boolean,
  allowedContentTypes: string[]
): string | null {
  const allowed = new Set(allowedContentTypes.map((type) => normalizeType(type)));
  for (const candidate of CLIP_CANDIDATES) {
    if (isSupported(candidate) && allowed.has(normalizeType(candidate))) return candidate;
  }
  return null;
}

/**
 * THE TYPE A CAPTURE IS UPLOADED AS, with the codecs stripped off.
 *
 * `MediaRecorder` hands back `video/webm;codecs=vp9,opus`, and that parameter
 * is not a detail: the service matches the content type against an allowlist,
 * a type it does not recognise is stored as a generic file, and a clip that
 * was recorded on the camera arrives in the thread as a `.txt` attachment.
 * That shipped — ogazboiz recorded a video on 2026-09-19 and got a TXT row.
 *
 * The same `normalizeType` the voice note and `validateUpload` use, so the
 * three cannot drift about what a recorded file's type IS.
 */
export function captureContentType(recorded: string): string {
  const base = normalizeType(recorded);
  return base === "video/mp4" ? "video/mp4" : "video/webm";
}

/**
 * The file name a capture is given.
 *
 * It never reaches the service for a photo or a clip — `fileName` is sent for
 * documents alone — but it is what a DOWNLOAD would be called, and an
 * extension that disagrees with the bytes is how a clip ends up saved as
 * something no player will open.
 */
export function captureFileName(kind: "photo" | "video", at: number, contentType?: string): string {
  const stamp = new Date(at).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (kind === "photo") return `square-photo-${stamp}.jpg`;
  const ext = normalizeType(contentType ?? "") === "video/mp4" ? "mp4" : "webm";
  return `square-clip-${stamp}.${ext}`;
}

/**
 * Which way the camera faces next.
 *
 * Two values only, because those are the two a phone has and the two
 * `facingMode` accepts as a plain request.
 */
export function flipFacing(current: "user" | "environment"): "user" | "environment" {
  return current === "user" ? "environment" : "user";
}

/**
 * A press, read as the gesture it turned out to be.
 *
 * Short press takes a photo; a press held past `CAMERA_HOLD_MS` was a
 * recording, and releasing it stops. The same button does both, which is the
 * gesture every camera in a messenger uses — and it means nothing is
 * mislabelled as a photo when the finger was slow.
 */
export function pressIntent(heldMs: number): "photo" | "clip" {
  return heldMs >= CAMERA_HOLD_MS ? "clip" : "photo";
}

/**
 * What to tell somebody whose camera did not open.
 *
 * The browser's own errors are named rather than described — `NotAllowedError`
 * on screen helps nobody — and each one has a different thing the reader can
 * actually do about it.
 */
export function cameraErrorCopy(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Square needs permission to use your camera. Allow it in your browser's settings, then try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera found on this device.";
    case "NotReadableError":
      return "Another app is using the camera. Close it and try again.";
    default:
      return "Couldn't open the camera.";
  }
}
