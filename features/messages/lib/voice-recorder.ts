/**
 * Choosing what a voice note is RECORDED as.
 *
 * `MediaRecorder` does not record whatever you ask for — each browser supports
 * a different, small set — and whatever comes out has to be a content type the
 * SERVICE accepts, or the upload is refused after the user has already
 * spoken. So the choice is an intersection of three things: what the browser
 * can encode, what the service's published allowlist takes, and (implicitly)
 * what the stored extension will be, since the attachment's kind is derived
 * from it.
 *
 * Opus in WebM first because it is the best small-file speech codec and what
 * Chrome and Firefox produce; `audio/mp4` next for Safari, which supports
 * neither WebM nor Opus. The codec suffix is dropped before comparing against
 * the allowlist, because `audio/webm;codecs=opus` and `audio/webm` are the
 * same stored object as far as the service is concerned — it normalises the
 * same way.
 *
 * Pure and free of DOM globals so it runs under `node --test`.
 */
import { normalizeType } from "../../../lib/upload-rules.ts";

/** Ordered by preference — first supported-and-allowed wins. */
export const RECORDING_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

/**
 * `audio/webm;codecs=opus` -> `audio/webm`. What the service allowlists.
 *
 * Re-exported rather than reimplemented: this module and `validateUpload` must
 * agree exactly on what a recorded file's type IS, and two copies of "strip
 * the parameter" is precisely the pair that drifts.
 */
export const baseType = normalizeType;

/**
 * The type to record in, or null when this browser cannot produce anything the
 * service would accept.
 *
 * Null is a real answer and must be handled: a browser we cannot record for
 * has to say so BEFORE the microphone is opened, rather than after somebody
 * has recorded a message that can never be sent.
 */
export function pickRecordingType(
  isSupported: (mimeType: string) => boolean,
  allowedContentTypes: string[]
): string | null {
  const allowed = new Set(allowedContentTypes.map((type) => baseType(type)));
  for (const candidate of RECORDING_CANDIDATES) {
    if (isSupported(candidate) && allowed.has(baseType(candidate))) return candidate;
  }
  return null;
}

/** "0:07", "1:04" — how a voice note's length reads under its waveform. */
export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The filename a recording is uploaded under.
 *
 * Cosmetic only — the service never trusts a client filename; it derives the
 * stored key's extension from the CONTENT TYPE it validated. This exists so
 * the `File` handed to the uploader is well-formed.
 */
export function recordingFileName(mimeType: string): string {
  // These mirror the service's own extension map. `webm` for audio-in-webm,
  // NOT `weba`: a CDN normalises the stored format to `webm` and serves
  // nothing at `.weba`, which is what made every voice note upload cleanly and
  // then 404 on playback.
  const ext = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg" }[baseType(mimeType)];
  return `voice-note.${ext ?? "webm"}`;
}
