/**
 * Which frame a story tile shows, and whether it is a clip.
 *
 * The rail tile drew whatever the first story's `mediaUrl` happened to be into
 * an `<img>`. When that story was a VIDEO the browser could not decode it and
 * painted its broken-image glyph — over a perfectly good seeded gradient — so
 * a story that played fine when opened advertised itself as broken in the
 * strip. Every video-first story in the app looked like a failed upload.
 *
 * Two decisions, and both are worth stating rather than inlining:
 *
 *  - **An image cover beats a video cover.** A still is what a tile wants, it
 *    costs one request instead of a partial video fetch, and a clip's first
 *    frame is often black. So a group with any photo in it shows the photo,
 *    even when a clip came first.
 *  - **`mediaKind` decides, not the file extension.** The backend types its
 *    own media now (CLAUDE.md), and a URL that ends in nothing recognisable —
 *    a signed CDN link, a path with no suffix — would otherwise be guessed as
 *    an image and put straight back into the broken `<img>` this exists to
 *    prevent. The extension stays as the fallback for older payloads.
 *
 * Pure, so `lib/story-cover.test.ts` can pin it without a renderer.
 */

/** Only the fields the decision reads. Structural so the test needs no fixtures. */
export interface StoryMedia {
  mediaUrl?: string | null;
  mediaKind?: string | null;
  /**
   * A poster the backend generated for this media.
   *
   * Null on every story in production today, but the field is in the payload
   * and it is the RIGHT cover when it arrives: one small image instead of a
   * partial video fetch, and a frame the service chose rather than whatever
   * happens to sit at 0.1s. Reading it now means tiles improve the day it
   * starts being populated, with no change here.
   */
  thumbnailUrl?: string | null;
}

export interface StoryCover {
  url: string;
  /** True when the tile must render a `<video>` rather than an `<img>`. */
  video: boolean;
}

/**
 * Extensions the viewer already treats as video, `.mov` included — it is what
 * an iPhone uploads, and it is the case most likely to reach a tile.
 */
const VIDEO_URL = /\.(mp4|webm|mov)(?:$|[?#])/iu;

export function isStoryVideoMedia(story: StoryMedia): boolean {
  const url = story.mediaUrl;
  if (!url) return false;
  // The backend's own answer wins wherever it has one.
  if (story.mediaKind) return story.mediaKind.toLowerCase().startsWith("video");
  return url.startsWith("data:video/") || VIDEO_URL.test(url);
}

/** The cover for a group of one author's stories, or null when none has media. */
export function storyCover(stories: readonly StoryMedia[] | null | undefined): StoryCover | null {
  const withMedia = (stories ?? []).filter(
    (story): story is StoryMedia & { mediaUrl: string } =>
      typeof story?.mediaUrl === "string" && story.mediaUrl.length > 0
  );
  if (withMedia.length === 0) return null;
  // A generated poster wins outright: it is an image by definition, so it
  // needs no decoding guess and no video element.
  const postered = withMedia.find(
    (story) => typeof story.thumbnailUrl === "string" && story.thumbnailUrl.length > 0
  );
  if (postered?.thumbnailUrl) return { url: postered.thumbnailUrl, video: false };

  const still = withMedia.find((story) => !isStoryVideoMedia(story));
  const chosen = still ?? withMedia[0];
  return { url: chosen.mediaUrl, video: isStoryVideoMedia(chosen) };
}
