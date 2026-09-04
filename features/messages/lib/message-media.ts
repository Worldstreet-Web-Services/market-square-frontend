import { isVideoUrl } from "../../../lib/media.ts";

/**
 * What kind of bubble a message needs, and the two numbers that shape it.
 *
 * The thread now draws four bubbles off one payload — text, photo, clip, voice
 * note — and which one is a decision the JSX must not be making, because the
 * fallback path (a `mediaUrl` with no `mediaKind`) is exactly the sort of
 * branch that gets simplified away by somebody who has only ever seen typed
 * payloads.
 *
 * BACKEND TYPE FIRST, URL SNIFF AS THE FALLBACK — the same rule `isVideoPost`
 * follows for the feed, and for the same reason: the service types its own
 * media, and extension sniffing only exists for rows written before it did.
 */

export type MessageMediaKind = "image" | "video" | "audio";

export interface MessageMedia {
  mediaUrl?: string | null;
  mediaKind?: string | null;
}

// Deliberately narrow, and deliberately not including `webm`: webm is a
// container that is far more often video here (the upload endpoint issues it
// for clips), so it belongs to `isVideoUrl` and is tested there first.
const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(\?|#|$)/i;

/**
 * The media on a message, or null when there is none.
 *
 * Null for a missing URL even when `mediaKind` is set: a kind with nothing to
 * load is a broken row, and rendering a photo bubble around no photo is worse
 * than rendering the text alone.
 */
export function messageMediaKind(message: MessageMedia): MessageMediaKind | null {
  const url = message.mediaUrl?.trim();
  if (!url) return null;

  const typed = message.mediaKind?.trim().toLowerCase();
  if (typed) {
    if (typed.startsWith("image")) return "image";
    if (typed.startsWith("video")) return "video";
    if (typed.startsWith("audio")) return "audio";
    // An unrecognised kind falls through to the sniff rather than being
    // dropped — the schema already `catch`es it to null, so this is the case
    // where a future backend sends something we have not enumerated yet.
  }

  if (AUDIO_EXTENSIONS.test(url) || url.startsWith("data:audio/")) return "audio";
  if (isVideoUrl(url)) return "video";
  return "image";
}

/**
 * `02:12`, and `1:02:12` for the rare long one.
 *
 * Empty string for anything unusable — a null duration, a NaN, a negative —
 * because the bubble then renders no duration at all. `00:00` under a voice
 * note the reader can hear is a lie about the file; an absent label is just an
 * absent label.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "";
  if (!Number.isFinite(seconds) || seconds < 0) return "";

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

/**
 * The media bubble's aspect ratio, as `width / height`.
 *
 * Null when the service did not send both — and null is what makes the bubble
 * fall back to a neutral box that CONTAINS the frame instead of cropping it to
 * a guess. Absurd ratios are rejected as well as missing ones: a 1x4000 strip
 * would produce a bubble taller than the pane.
 */
export function mediaRatio(
  width: number | null | undefined,
  height: number | null | undefined
): number | null {
  if (!Number.isFinite(width ?? NaN) || !Number.isFinite(height ?? NaN)) return null;
  const w = width as number;
  const h = height as number;
  if (w <= 0 || h <= 0) return null;

  const ratio = w / h;
  if (ratio < 0.25 || ratio > 4) return null;
  return ratio;
}

/**
 * The attachment as it arrives on the wire, flattened onto the message.
 *
 * The service sends ONE nullable object — `media: { url, kind, width, height,
 * durationSeconds } | null` — which is the shape the database enforces
 * (`(media_url IS NULL) = (media_kind IS NULL)`, so a URL without a kind
 * cannot exist). Every reader in the pane wants `message.mediaUrl`, so the
 * flattening happens once, here, rather than in the JSX.
 *
 * IT EXISTS BECAUSE THIS EXACT MISMATCH SHIPPED. The schema was written to
 * parse five independent optional fields (`mediaUrl`, `mediaKind`, …) while
 * the service sent them nested. Every one of the five defaulted to null, so
 * nothing threw and nothing was logged — a photo simply never appeared, which
 * reads as "the backend has not sent one yet" rather than as a bug. A
 * transform in one place, pinned by a test, is what makes the wire shape and
 * the render shape unable to drift apart silently again.
 */
export interface WireMessageMedia {
  url: string;
  kind?: "image" | "video" | "audio" | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}

export interface FlatMessageMedia {
  mediaUrl: string | null;
  mediaKind: "image" | "video" | "audio" | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaDurationSeconds: number | null;
}

export function flattenMessageMedia(
  media: WireMessageMedia | null | undefined,
): FlatMessageMedia {
  return {
    mediaUrl: media?.url ?? null,
    mediaKind: media?.kind ?? null,
    mediaWidth: media?.width ?? null,
    mediaHeight: media?.height ?? null,
    mediaDurationSeconds: media?.durationSeconds ?? null,
  };
}
