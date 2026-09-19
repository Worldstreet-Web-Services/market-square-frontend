/**
 * A DM ATTACHMENT'S LINK, WHICH IS NOW A CREDENTIAL AND EXPIRES.
 *
 * A private thread's photo used to be a storage URL: permanent, and readable
 * by anybody it was ever pasted to. The service now hands out a SIGNED link
 * instead — `GET /media/messages/:id?variant=display|download&exp=…&sig=…`,
 * an HMAC over the message, the variant and the expiry, redirected to storage
 * for a few minutes. Holding the link is the whole permission, so the link is
 * short-lived on purpose, and this module is what the pane knows about that:
 *
 *   · WHEN A LINK IS SPENT. `urlExpiresAt` is the service's own deadline; we
 *     treat a link as spent slightly BEFORE it, because a request that leaves
 *     now arrives later and a clock that is thirty seconds fast is ordinary.
 *   · WHICH LINK SAVES THE FILE. The service mints a `download` variant, and
 *     that is the only way to save one: the old trick of rewriting a
 *     Cloudinary URL into `fl_attachment:<name>` cannot work on a signed link,
 *     because editing the URL is exactly what the signature forbids.
 *
 * ─── WHY BOTH SHAPES ARE HANDLED ─────────────────────────────────────────────
 * `downloadUrl` and `urlExpiresAt` are absent from every message the deployed
 * service sends today, and this frontend must reach production BEFORE the
 * service changes or every DM attachment silently loses its Save control. So
 * a payload without them is not a broken payload — it is today's, and it falls
 * back to the Cloudinary rewrite. A payload with them ignores the rewrite
 * entirely. Neither branch is dead code until the older messages are gone.
 *
 * Pure, so `lib/message-media-link.test.ts` pins it.
 */

// Relative, with the extension: this module is pinned by `node --test`, which
// does not read the bundler's `@/` alias.
import { mediaDownloadUrl } from "./media-download.ts";

/**
 * How early a link counts as spent.
 *
 * Covers the flight time of the request the link is used in plus a modest
 * clock difference. Too small and the reader meets a 410 that a refetch would
 * have avoided; too large and we refetch a thread that was fine.
 */
export const MEDIA_LINK_SKEW_MS = 30_000;

export interface MediaLinkFields {
  mediaUrl?: string | null;
  mediaDownloadUrl?: string | null;
  mediaUrlExpiresAt?: string | null;
}

/**
 * Has this link run out?
 *
 * False when there is no deadline: a payload without `urlExpiresAt` is a
 * storage URL from the old world, and calling that "expired" would hide media
 * that renders perfectly well. False, too, for a deadline we cannot read —
 * an unparseable date is a service bug, and refusing to draw the photo is a
 * worse answer to it than drawing one that may 410.
 */
export function mediaLinkExpired(
  urlExpiresAt: string | null | undefined,
  now: number,
  skewMs: number = MEDIA_LINK_SKEW_MS
): boolean {
  if (!urlExpiresAt) return false;
  const deadline = Date.parse(urlExpiresAt);
  if (Number.isNaN(deadline)) return false;
  return now + skewMs >= deadline;
}

/**
 * The link that SAVES this attachment, or null when there is none to offer.
 *
 * The service's own `download` variant wins wherever it is present — it is
 * signed for exactly this, and answers with `Content-Disposition: attachment`.
 * Without one we are looking at a message from before signed links, and the
 * Cloudinary rewrite is still the only way to save it. Null draws no control,
 * never a link that would open the file in place and call itself a download.
 */
export function downloadLinkFor(media: MediaLinkFields, baseName: string): string | null {
  const signed = media.mediaDownloadUrl?.trim();
  if (signed) return signed;
  return mediaDownloadUrl(media.mediaUrl, baseName);
}
