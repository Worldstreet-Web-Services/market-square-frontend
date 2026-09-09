/**
 * What may be uploaded, and by which route.
 *
 * Pure and dependency-free on purpose: `lib/api/upload.ts` is a client module
 * that pulls in Privy, so these rules live apart from it to stay testable
 * under `node --test` (which resolves neither the `@/` alias nor a browser
 * environment) and reusable from anywhere.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];

/** The upload contract: what may be sent, and how big. */
export interface UploadLimits {
  maxImageBytes: number;
  maxVideoBytes: number;
  imageContentTypes: string[];
  videoContentTypes: string[];
  /**
   * ADVISORY clip length, in seconds. The backend publishes it but does NOT
   * enforce it — knowing a duration means demuxing the file, and on the
   * presign path the service never sees the bytes. WE are the only thing
   * checking it, which makes it a courtesy to the user (don't waste their
   * upload) rather than a control. The enforced limit is `maxVideoBytes`.
   */
  maxVideoSeconds: number;
}

/**
 * FALLBACK ONLY. The backend is the source of truth.
 *
 * These numbers used to be the source of truth here AND in the service, hand-
 * copied between two repositories. That is a contract with two owners: raise it
 * on the server alone and we refuse a file the server would have taken; raise
 * it here alone and the user watches a 300 MB upload finish and then fail. The
 * caps are env-overridable per environment, so a compiled-in number is wrong
 * by construction the moment an operator tunes one.
 *
 * They survive as the answer to "GET /uploads/limits did not come back" —
 * better a stale cap than a composer that cannot validate at all. They are
 * deliberately the CURRENT server defaults, so a fallback is conservative in
 * the same direction the server is.
 */
export const FALLBACK_LIMITS: UploadLimits = {
  maxImageBytes: 25 * 1024 * 1024,
  maxVideoBytes: 200 * 1024 * 1024,
  imageContentTypes: IMAGE_TYPES,
  videoContentTypes: VIDEO_TYPES,
  maxVideoSeconds: 90,
};

let current: UploadLimits = FALLBACK_LIMITS;

/** The limits validation should use right now. Never null — falls back. */
export function getUploadLimits(): UploadLimits {
  return current;
}

/**
 * Adopt limits fetched from the backend.
 *
 * Defensive on purpose: this is parsed from a network response, and a limit of
 * `0`, `NaN` or a negative would silently reject every file the user picks —
 * a worse failure than the stale fallback, because it looks like their file is
 * the problem. Each field is taken only when it is usable, so a partial or
 * malformed payload degrades field-by-field instead of all at once.
 */
export function setUploadLimits(limits: Partial<UploadLimits> | null | undefined): UploadLimits {
  const positive = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0;
  const types = (value: unknown): value is string[] =>
    Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string");

  current = {
    maxImageBytes: positive(limits?.maxImageBytes) ? limits.maxImageBytes : current.maxImageBytes,
    maxVideoBytes: positive(limits?.maxVideoBytes) ? limits.maxVideoBytes : current.maxVideoBytes,
    imageContentTypes: types(limits?.imageContentTypes)
      ? limits.imageContentTypes
      : current.imageContentTypes,
    videoContentTypes: types(limits?.videoContentTypes)
      ? limits.videoContentTypes
      : current.videoContentTypes,
    maxVideoSeconds: positive(limits?.maxVideoSeconds)
      ? limits.maxVideoSeconds
      : current.maxVideoSeconds,
  };
  return current;
}

/** Test seam — restores the module to its pre-fetch state. */
export function resetUploadLimits(): void {
  current = FALLBACK_LIMITS;
}

/**
 * The largest body we will push through our own BFF.
 *
 * Vercel serverless functions reject any request body over 4.5 MB with
 * FUNCTION_PAYLOAD_TOO_LARGE. It is a platform limit, not a setting, so a
 * 7.5 MB video can never reach the service through the proxy however high our
 * own video cap is. Anything above this goes direct to storage instead.
 *
 * 4 MB rather than 4.5 leaves room for multipart framing and headers, which
 * also count toward the limit.
 */
export const PROXY_MAX_BYTES = 4 * 1024 * 1024;

/** "7.5 MB" — so a rejection can name the file's ACTUAL size, not just the cap. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "1:30", "45s" — how a person reads a clip length back. */
export function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

/**
 * The clip-length check.
 *
 * ADVISORY: the backend publishes `maxVideoSeconds` but enforces nothing, so
 * this is the only place it is applied. It exists to stop a well-behaved app
 * wasting somebody's upload, not to stop an attacker — a determined client
 * simply would not call it.
 *
 * `null` duration means we could not read it (a codec the browser will not
 * decode, or metadata that never arrived). That is NOT a rejection: refusing a
 * clip because our own probe failed would block a perfectly valid upload for a
 * reason the user cannot act on. We let it through and the byte cap — which IS
 * enforced — still applies.
 */
export function validateVideoDuration(
  seconds: number | null,
  limits: UploadLimits = getUploadLimits()
): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds <= limits.maxVideoSeconds) return null;
  return (
    `Videos must be under ${formatDuration(limits.maxVideoSeconds)} — ` +
    `this one is ${formatDuration(seconds)}. Trim it and try again.`
  );
}

/** Types a picker might offer that we reject, each with the way out. */
const EXTENSION_HINT: Record<string, string> = {
  "video/quicktime": "MOV videos aren't supported yet — convert it to MP4.",
  "image/heic": "HEIC photos aren't supported — export as JPEG first.",
  "image/heif": "HEIF photos aren't supported — export as JPEG first.",
  "image/avif": "AVIF images aren't supported — use JPEG, PNG, WebP or GIF.",
};

export interface UploadCandidate {
  type: string;
  size: number;
}

/**
 * Client-side pre-check, run BEFORE any network call.
 *
 * Every rejection names the limit AND the file's real size, because "too
 * large" on its own tells the reader nothing about what to do next. Returns a
 * human message, or null when the file is acceptable.
 */
export function validateUpload(
  file: UploadCandidate,
  accept: "image" | "media",
  limits: UploadLimits = getUploadLimits()
): string | null {
  const isImage = limits.imageContentTypes.includes(file.type);
  const isVideo = limits.videoContentTypes.includes(file.type);

  if (!isImage && !isVideo) {
    const hint = EXTENSION_HINT[file.type];
    if (hint) return hint;
    return accept === "image"
      ? "Use a JPEG, PNG, WebP or GIF image."
      : "Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, WebM).";
  }
  if (accept === "image" && isVideo) return "This field takes an image, not a video.";

  if (isImage && file.size > limits.maxImageBytes) {
    // GIFs blow past the image cap far more often than stills, so name the
    // kind of file the reader actually picked.
    const label = file.type === "image/gif" ? "GIFs" : "Images";
    return `${label} must be under ${formatBytes(limits.maxImageBytes)} — this one is ${formatBytes(file.size)}.`;
  }
  if (isVideo && file.size > limits.maxVideoBytes) {
    return `Videos must be under ${formatBytes(limits.maxVideoBytes)} — this one is ${formatBytes(file.size)}.`;
  }
  return null;
}

export function uploadKind(
  file: UploadCandidate,
  limits: UploadLimits = getUploadLimits()
): "image" | "video" {
  return limits.videoContentTypes.includes(file.type) ? "video" : "image";
}

/**
 * Which transport carries this file.
 *
 * Keyed on SIZE alone: the constraint is a request-body limit, which does not
 * care whether the bytes are a GIF or a clip.
 */
export function shouldUploadDirect(file: UploadCandidate): boolean {
  return file.size > PROXY_MAX_BYTES;
}

/**
 * The `accept` attribute for a file picker.
 *
 * A HINT, not a check — a picker's accept filter is advisory (users can always
 * choose "all files", and some platforms ignore it), so `validateUpload` stays
 * the authority and reads the LIVE allowlist. These built-in strings are the
 * fallback set; `acceptFor` derives the same thing from fetched limits for
 * call sites that have them.
 */
export const ACCEPT_IMAGE = IMAGE_TYPES.join(",");
export const ACCEPT_MEDIA = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");

export function acceptFor(
  accept: "image" | "media",
  limits: UploadLimits = getUploadLimits()
): string {
  return accept === "image"
    ? limits.imageContentTypes.join(",")
    : [...limits.imageContentTypes, ...limits.videoContentTypes].join(",");
}
