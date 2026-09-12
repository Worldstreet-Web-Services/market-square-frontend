/**
 * A POST'S PICTURES, AS A LIST — node 1029:22591.
 *
 * The service answers `media: [{ url, kind, width, height, thumbnailUrl }]` on
 * every post, in order, `[]` for a text post, with `mediaUrl` and friends still
 * mirroring the first item. A deployment that predates the list sends no
 * `media` key at all, so ABSENT is a real answer here: it means "this server
 * takes one picture per post", and it is the only thing that switches the
 * composer's multi-pick on (`carriesMediaList`). Nothing is guessed from a
 * version string or a flag.
 *
 * The rules the service enforces, mirrored so the composer refuses a pick with
 * the service's own words before any byte is uploaded:
 *  - 1 to 10 items;
 *  - ONE item may be a photo or a video, TWO OR MORE must all be photos;
 *  - a story carries one item.
 *
 * Pure — no React, no DOM — so `node --test` pins it.
 */

export interface PostMediaLike {
  url: string;
  kind: string;
  thumbnailUrl?: string | null;
}

/** The most items one post carries. The service refuses an eleventh. */
export const MAX_POST_MEDIA = 10;

/** The post's media in order: the served list, or the one `mediaUrl` an older payload carries. */
export function postMediaList(post: {
  media?: readonly PostMediaLike[] | null;
  mediaUrl?: string | null;
  mediaKind?: string | null;
  thumbnailUrl?: string | null;
}): PostMediaLike[] {
  if (Array.isArray(post.media)) return [...post.media];
  if (!post.mediaUrl) return [];
  return [{ url: post.mediaUrl, kind: post.mediaKind ?? "image", thumbnailUrl: post.thumbnailUrl ?? null }];
}

/** True once any post in hand carries the `media` list — the server takes lists. */
export function carriesMediaList(posts: ReadonlyArray<{ media?: unknown } | null | undefined>): boolean {
  return posts.some((post) => post != null && Array.isArray(post.media));
}

/** What an attachment IS: the service's own typing first, the picked file's as a fallback. */
export function attachmentKind(served: string | null | undefined, picked: string | null | undefined): "image" | "video" {
  return (served ?? picked) === "video" ? "video" : "image";
}

/**
 * The media fields of a create-post request.
 *
 * One item keeps the `mediaUrl` every deployment understands; only two or
 * more send `media`, which the service refuses alongside `mediaUrl`. Every url
 * must be the one `/uploads/complete` returned for the author's own upload —
 * a delivered (transformed) address is refused as FORBIDDEN.
 */
export function mediaFields(
  attached: ReadonlyArray<{ url: string; kind: "image" | "video" }>
): { mediaUrl?: string; media?: { url: string; kind: "image" | "video" }[] } {
  if (attached.length === 0) return {};
  if (attached.length === 1) return { mediaUrl: attached[0].url };
  return { media: attached.map(({ url, kind }) => ({ url, kind })) };
}

/** Why this set of attachments cannot be posted, in the service's words, or null. */
export function checkMediaSelection(
  kinds: ReadonlyArray<string | null | undefined>,
  { story, max }: { story: boolean; max: number }
): string | null {
  if (kinds.length <= 1) return null;
  if (story) return "A story carries one photo or video.";
  if (kinds.length > max) return `Up to ${max} photos in one post.`;
  if (kinds.some((kind) => kind !== "image")) return "A post with more than one item carries photos only.";
  return null;
}

/*
  THE RAIL'S GEOMETRY — node 1029:22591.

  Tiles 250.93 × 352.22 at radius 20.72, 10.36 apart. The dots sit 20 above
  them, 4.99 tall at radius 15.59, 3.12 apart: the current one 31.17 wide in
  purple, the file's next one 11.85 and the rest 10.60 in #D9D9D9.
*/
export const RAIL_TILE_WIDTH = 250.93;
export const RAIL_GAP = 10.36;

/**
 * THE RAIL AT TWO SIZES, because two nodes draw the same object.
 *
 * `post` — 1029:22591, the card in the column: 250.93 x 352.22 tiles at radius
 *   20.72, 10.36 apart, dots 4.99 tall (31.17 / 11.85 / 10.60).
 * `compact` — 1313:152774, the card in Home's "Post For You" row, which is the
 *   same strip drawn smaller: 134.3 x 188.52 at radius 11.09, 5.54 apart, dots
 *   2.67 tall (16.69 / 6.34 / 5.67).
 *
 * One component reads these rather than a second rail being built, and the
 * column's numbers are untouched so its own tests still hold.
 */
export const RAIL_SIZES = {
  post: {
    tile: 250.93,
    tileHeight: 352.22,
    radius: 20.72,
    gap: 10.36,
    dotHeight: 4.99,
    dotGap: 3.12,
    dots: { active: 31.17, next: 11.85, rest: 10.6 },
  },
  compact: {
    tile: 134.3,
    tileHeight: 188.52,
    radius: 11.09,
    gap: 5.54,
    dotHeight: 2.67,
    dotGap: 1.67,
    dots: { active: 16.69, next: 6.34, rest: 5.67 },
  },
} as const;

export type RailSize = keyof typeof RAIL_SIZES;

export function railDotWidth(index: number, active: number, size: RailSize = "post"): number {
  const { dots } = RAIL_SIZES[size];
  if (index === active) return dots.active;
  return index === active + 1 ? dots.next : dots.rest;
}

/** Which tile the rail is on, from its scroll offset. The far end is always the last tile. */
export function railIndexAt(
  scrollLeft: number,
  maxScroll: number,
  count: number,
  size: RailSize = "post"
): number {
  if (count <= 0) return 0;
  if (maxScroll > 0 && scrollLeft >= maxScroll - 1) return count - 1;
  const { tile, gap } = RAIL_SIZES[size];
  const index = Math.round(scrollLeft / (tile + gap));
  return Math.min(count - 1, Math.max(0, index));
}
