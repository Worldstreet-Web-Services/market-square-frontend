"use client";

/**
 * Reads a video file's duration in the browser, before anything is uploaded.
 *
 * This is the DOM half of the advisory clip-length guard; the rule itself
 * (`validateVideoDuration`) lives in `lib/upload-rules.ts` so it stays
 * testable under `node --test`. Split because this half cannot be tested there
 * at all — it needs a real media element and a real decoder.
 *
 * Everything here is best-effort by design. The browser decides whether it can
 * decode a container, metadata can arrive incomplete, and a stream with no
 * declared duration reports `Infinity`. In every one of those cases we return
 * `null` and the caller lets the file through: the enforced limit is the byte
 * cap, and refusing an upload because OUR probe failed would block a valid
 * file for a reason the user can do nothing about.
 */

/** Give up rather than leave the user staring at a file picker that hangs. */
const METADATA_TIMEOUT_MS = 5000;

export function readVideoDuration(
  file: Blob,
  timeoutMs: number = METADATA_TIMEOUT_MS
): Promise<number | null> {
  // No DOM (SSR, tests): nothing to probe with.
  if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let done = false;

    // One exit point, so the object URL and the timer are released on every
    // path — a leaked object URL pins the whole file in memory, and these are
    // hundreds of megabytes.
    const finish = (duration: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      // Tells the media stack to let go of the buffer, not just the element.
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    video.preload = "metadata";
    // Muted + no autoplay: we are measuring, never playing. Without this,
    // some browsers treat the element as a playback attempt.
    video.muted = true;
    video.onloadedmetadata = () => {
      const { duration } = video;
      // A live/unsized stream reports Infinity, and a failed parse can report
      // NaN. Neither is a length, so neither is a rejection.
      finish(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}
