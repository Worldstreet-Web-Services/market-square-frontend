/**
 * A SQUARE LINK, READ BACK INTO THE THING IT POINTS AT.
 *
 * ogazboiz, 2026-09-21: share a link "just like how X is, so we can post it as
 * a normal post". On X a pasted link stops being a string of characters and
 * becomes the thing itself — a card you can recognise without following it.
 * That is the difference between a post that says
 * `https://square.tsionark.com/p/034OqIADSAafQwmr157BHm` and a post that shows
 * whose post it is and what it says.
 *
 * ─── OUR OWN LINKS FIRST, AND THAT IS NOT A SHORTCUT ─────────────────────────
 * A Square link resolves from routes this app already has: the post, the
 * profile and the room are all one authenticated GET away. An EXTERNAL link
 * cannot be — reading somebody else's page means a server that fetches
 * arbitrary URLs, which is an SSRF surface and belongs to the service with a
 * cache, an allowlist and a timeout. So this module reads OUR links, and
 * external unfurling is asked for separately rather than faked here.
 *
 * ─── WHICH ORIGINS COUNT ─────────────────────────────────────────────────────
 * Square is served from three places that are all legitimately "us": its own
 * domain, the `/square` zone inside Ark, and localhost while developing. The
 * path is what identifies the thing; the origin only decides whether the link
 * is ours at all. A link to somebody ELSE's site that happens to contain `/p/`
 * must never resolve — that is the check this exists to get right.
 *
 * Pure, so `lib/square-link.test.ts` pins it.
 */

/** What a Square link can point at, today. */
export type SquareRefKind = "post" | "profile" | "room";

export interface SquareRef {
  kind: SquareRefKind;
  /** A post or room id, or a username for a profile. Never a whole path. */
  id: string;
}

/** The hosts a Square link may legitimately live on. */
export const SQUARE_HOSTS = [
  "square.tsionark.com",
  "www.tsionark.com",
  "tsionark.com",
  "localhost",
] as const;

/**
 * Is this URL one of ours?
 *
 * `hostname` rather than `host`, so a port never matters, and an exact match
 * rather than `endsWith` — `notsquare.tsionark.com.evil.test` ends with our
 * domain and is not us.
 */
function ours(url: URL): boolean {
  return (SQUARE_HOSTS as readonly string[]).includes(url.hostname);
}

/**
 * The path, with the Ark zone's `/square` prefix removed.
 *
 * The same page is `/p/x` standalone and `/square/p/x` inside Ark, and a
 * shared link carries whichever one the sharer was looking at.
 */
function squarePath(pathname: string): string {
  const path = pathname.replace(/\/+$/, "");
  return path.startsWith("/square/") ? path.slice("/square".length) : path === "/square" ? "" : path;
}

/**
 * The thing a link points at, or null when it points at nothing we can draw.
 *
 * Null is the common case and not a failure: most links in a post are not
 * Square links, and a Square link to a page with no card (settings, the feed
 * itself) is left as plain text rather than given a card that says nothing.
 */
export function parseSquareLink(raw: string): SquareRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!ours(url)) return null;

  const segments = squarePath(url.pathname).split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [head, value] = segments as [string, string];
  // Only the first two segments are read: `/p/<id>/anything` is still that
  // post, and a longer path is not a different thing.
  if (!value) return null;

  if (head === "p") return { kind: "post", id: value };
  if (head === "u") return { kind: "profile", id: value };
  if (head === "gist-rooms") return { kind: "room", id: value };
  return null;
}

/**
 * The FIRST Square link in a piece of text, with the exact text that matched.
 *
 * One card per post, deliberately. A post with four links is not four cards —
 * it is a post about four things, and stacking four previews under it buries
 * whatever the person actually wrote. X shows one, for the same reason.
 */
export function firstSquareLink(text: string | null | undefined): { ref: SquareRef; href: string } | null {
  if (!text) return null;
  // Bare word boundaries: a URL ends at whitespace. Trailing punctuation is
  // trimmed because "look at https://…/p/abc." is a sentence, not a path.
  for (const token of text.split(/\s+/)) {
    const href = token.replace(/[.,;:!?)\]]+$/, "");
    const ref = parseSquareLink(href);
    if (ref) return { ref, href };
  }
  return null;
}

/**
 * The text a post is prefilled with when somebody shares into the composer.
 *
 * Just the link. Not "Check this out — <link>": the sharer is about to type
 * what they think, and deleting somebody else's words before you can write
 * your own is a worse start than an empty box with a link in it.
 */
export function shareIntoPostText(url: string): string {
  return url.trim();
}
