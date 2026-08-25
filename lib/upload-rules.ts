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
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

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
export function validateUpload(file: UploadCandidate, accept: "image" | "media"): string | null {
  const isImage = IMAGE_TYPES.includes(file.type);
  const isVideo = VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    const hint = EXTENSION_HINT[file.type];
    if (hint) return hint;
    return accept === "image"
      ? "Use a JPEG, PNG, WebP or GIF image."
      : "Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, WebM).";
  }
  if (accept === "image" && isVideo) return "This field takes an image, not a video.";

  if (isImage && file.size > MAX_IMAGE_BYTES) {
    // GIFs blow past the image cap far more often than stills, so name the
    // kind of file the reader actually picked.
    const label = file.type === "image/gif" ? "GIFs" : "Images";
    return `${label} must be under ${formatBytes(MAX_IMAGE_BYTES)} — this one is ${formatBytes(file.size)}.`;
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return `Videos must be under ${formatBytes(MAX_VIDEO_BYTES)} — this one is ${formatBytes(file.size)}.`;
  }
  return null;
}

export function uploadKind(file: UploadCandidate): "image" | "video" {
  return VIDEO_TYPES.includes(file.type) ? "video" : "image";
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

/** The accept attribute for a file picker, mirroring the allowlist exactly. */
export const ACCEPT_IMAGE = IMAGE_TYPES.join(",");
export const ACCEPT_MEDIA = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");
