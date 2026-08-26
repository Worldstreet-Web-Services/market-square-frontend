/**
 * The immersive video viewer's list identity.
 *
 * Tapping a video card on Explore opens a full-screen player that scrolls
 * through the OTHER videos in the same selection — so the viewer and the grid
 * must resolve to exactly ONE list, not two lists that happen to look alike.
 * The viewer therefore continues the grid's pagination instead of starting its
 * own: scrolling past the loaded page fetches the next one exactly as the grid
 * would, because it IS the grid's query.
 *
 * Both of Explore's lists get that property, by different routes:
 *   - BROWSE — `videoListKey` derives one cache key from the topic selection,
 *     and `useTopicVideos` is the single hook behind grid and viewer alike.
 *   - SEARCH — `useDiscovery` is already keyed on query + type + topics, so
 *     the viewer reading the same hook lands on the same entry for free.
 */

import type { DeepLink, Profile } from "@/lib/api/schemas";

/** The minimum a slide needs. Counts are OPTIONAL — see below. */
export interface VideoItem {
  id: string;
  text: string;
  mediaUrl: string | null;
  /** The backend types its own media; `isVideoPost` sniffs the URL only as a fallback. */
  mediaKind?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  author?: Profile | null;
  /**
   * Tallies are optional because not every payload carries them. A missing
   * count renders NOTHING — never `0`. "This payload has no like count" and
   * "nobody has liked this" are different claims, and printing the second for
   * the first is the small dishonesty the house rules exist to prevent.
   */
  likeCount?: number;
  commentCount?: number;
  likedByMe?: boolean;
  deepLink?: DeepLink | null;
}

/**
 * The browse list's shared cache key.
 *
 * Topics are SORTED, so the same selection always produces the same key
 * regardless of the order the reader ticked the chips — otherwise the grid and
 * the viewer would sit on two caches and the viewer would re-fetch page one,
 * which is the exact bug this key exists to make impossible.
 */
export function videoListKey(topics: string[]): string {
  return [...topics].sort().join(",");
}

/**
 * Move between slides. Clamps rather than wraps: running off the end of a
 * loaded page must ask for the next one, and wrapping to the top would hide
 * that there is more to fetch.
 */
export function nextVideoIndex(index: number, delta: number, length: number): number {
  if (length === 0) return 0;
  const next = index + delta;
  if (next < 0) return 0;
  if (next > length - 1) return length - 1;
  return next;
}

/**
 * The shareable URL for an open video.
 *
 * It carries the SELECTION as well as the video, so opening the link
 * reproduces the same scroll list the sharer was in rather than a lone clip.
 * Saved interests are deliberately NOT pinned: they belong to whoever opens
 * the link, not to whoever shared it.
 */
export function videoHref(
  videoId: string,
  selection: { query?: string; tab?: string },
  pathname = "/discover"
): string {
  const params = new URLSearchParams();
  const query = selection.query?.trim() ?? "";
  if (query) params.set("q", query);
  // "for-you" is the default the page falls back to, so it stays out of the URL.
  if (selection.tab && selection.tab !== "for-you") params.set("tab", selection.tab);
  params.set("v", videoId);
  return `${pathname}?${params.toString()}`;
}
