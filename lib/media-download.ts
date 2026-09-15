/**
 * A LINK THAT DOWNLOADS A CHAT PICTURE OR CLIP, instead of opening it.
 *
 * A plain `<a download>` does nothing for a file on another origin — browsers
 * ignore the attribute cross-origin and just navigate to the picture. Every
 * attachment lives on Cloudinary, so the download has to be asked of the file
 * host: the `fl_attachment:<name>` flag makes it answer with
 * `Content-Disposition: attachment; filename="<name>.<ext>"`, and the browser
 * saves the file. Checked against the real host: an image and a video both
 * came back 200 with that header, at full original size.
 *
 * TWO RULES, both learned by testing rather than assumed:
 *
 *  · THE DELIVERY TRANSFORMATION IS DROPPED, not prefixed. `fl_attachment`
 *    placed in front of an existing `f_auto,q_auto,w_1280,c_limit` answered
 *    400. Dropping it also downloads the ORIGINAL rather than the resized copy
 *    the thread displays — which is what saving a photo should give you.
 *  · ONLY A KEY THIS SERVICE ISSUED. The service mints every attachment as
 *    `uploads/<owner>/<kind>/<file>` (optionally after a `v<n>` version), so
 *    anything without that `uploads/` segment gets no download link at all
 *    rather than one built on a guess about its shape.
 *
 * Null means "no download for this one": the caller offers nothing, never a
 * link that would open the file in place and call itself a download.
 *
 * Pure, so `node --test` pins it.
 */

const HOST = "res.cloudinary.com";
const UPLOAD_PATH = /^\/([^/]+)\/(image|video)\/upload\/(.+)$/;

/** A filename Cloudinary's flag accepts: letters, digits, `_` and `-` only. */
export function safeFileName(base: string): string {
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "square-media";
}

export function mediaDownloadUrl(url: string | null | undefined, baseName: string): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== HOST || parsed.port || parsed.username) return null;

  const match = UPLOAD_PATH.exec(parsed.pathname);
  if (!match) return null;
  const [, cloud, resource, rest] = match as unknown as [string, string, string, string];

  const segments = rest.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  const at = segments.indexOf("uploads");
  if (at < 0 || at === segments.length - 1) return null;
  // Keep a version segment that sits directly before the key.
  const from = at > 0 && /^v\d+$/.test(segments[at - 1]!) ? at - 1 : at;

  return `https://${HOST}/${cloud}/${resource}/upload/fl_attachment:${safeFileName(baseName)}/${segments
    .slice(from)
    .join("/")}`;
}
