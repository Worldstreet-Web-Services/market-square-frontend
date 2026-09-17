/**
 * SHARE PREVIEWS — the Open Graph and Twitter tags a pasted link unfurls into.
 *
 * Until this existed `/p/:id` and `/u/:username` emitted no `og:` tags at all,
 * so a post dropped into WhatsApp arrived as a bare URL. These builders turn
 * what a SIGNED-OUT visitor can already read into the card a crawler shows:
 * the author's name, the post's own words, and a picture.
 *
 * WHAT GOES IN, AND WHAT NEVER DOES:
 *  · The post's OWN `text` only — never a quoted post, never a comment. A
 *    preview speaks for the person who wrote the post and nobody else.
 *  · A name, never an id. Names fall back through `ProfileSchema` (the same
 *    "Member ·GT4T" everywhere else uses) and handles through `atHandle`, which
 *    refuses to print a `did:`.
 *  · Pictures ONLY from our own Cloudinary cloud, rewritten to a crawler-sized
 *    JPEG (`ogImageUrl`). An author-supplied URL — a link preview's image, an
 *    arbitrary host — is never published as our card: that would let anyone
 *    put any picture under Square's name.
 *  · STORIES get the generic card. They expire; a preview cached by a chat app
 *    for days would outlive the thing it shows.
 *
 * Relative URLs here (`/p/…`, `/share-card`) resolve against the root
 * layout's `metadataBase`.
 *
 * Pure: no Next imports, so `node --test` pins every rule. The shapes below are
 * structurally the subset of Next's `Metadata` these routes use.
 */

import { z } from "zod";
import { ProfileSchema } from "./api/schemas.ts";
import { atHandle } from "./handle.ts";
import type { OgFetchResult } from "./server/og-fetch.ts";
import { sq } from "./square-path.ts";

export const SITE_ORIGIN = "https://square.tsionark.com";

/**
 * THE ORIGIN EVERY RELATIVE PREVIEW URL RESOLVES AGAINST (`metadataBase`).
 *
 * Production, and anywhere that is not a Vercel preview, is the real domain —
 * a canonical is a claim about the site, not about the box that rendered it.
 * A PREVIEW deploy is its own origin: pointing its `og:url` and fallback card
 * at production would send Facebook and the rest to scrape production's page,
 * which does not have the change being previewed, so every real-app test run
 * against a preview would silently test the wrong build. `VERCEL_URL` is the
 * deployment's host with no scheme, set by Vercel at build and at runtime.
 */
export function siteOrigin(env: Readonly<Record<string, string | undefined>>): string {
  const host = env.VERCEL_URL?.trim();
  if (env.VERCEL_ENV === "preview" && host && /^[a-z0-9.-]+$/i.test(host)) return `https://${host}`;
  /*
    THE CANONICAL HOST IS CONFIGURATION, NOT CODE. The Square moves to
    www.tsionark.com/square as a Vercel microfrontend, and every canonical and
    og:url should name that address once it serves the Square. Before the
    microfrontends group exists, www.tsionark.com/square routes nowhere, so a
    hard-coded www canonical would send search engines and preview scrapers to a
    404. Set SQUARE_CANONICAL_ORIGIN=https://www.tsionark.com when it is live;
    until then it stays square.tsionark.com, which serves the same /square paths.
    A value that is not a bare https origin is ignored rather than trusted.
  */
  const canonical = env.SQUARE_CANONICAL_ORIGIN?.trim();
  if (canonical && /^https:\/\/[a-z0-9.-]+$/i.test(canonical)) return canonical;
  return SITE_ORIGIN;
}
export const SITE_NAME = "Square";
export const SITE_DESCRIPTION =
  "The social square of the Ark platform: live streams, the ARK Store, creators and community.";

export const DESCRIPTION_MAX = 200;

export interface OgImage {
  url: string;
  width: number;
  height: number;
  type: string;
  alt: string;
}

/**
 * The branded card for everything without a picture of its own — served by the
 * route handler `app/share-card/route.tsx` at exactly this path. Not the
 * `opengraph-image` file convention: file-based metadata overrides
 * `generateMetadata`, which would put this card over every post's own photo.
 */
export const FALLBACK_OG_IMAGE: OgImage = {
  url: sq("/share-card"),
  width: 1200,
  height: 630,
  type: "image/png",
  alt: SITE_NAME,
};

export interface ShareMetadata {
  title: string | { absolute: string };
  description: string;
  alternates?: { canonical: string };
  openGraph: {
    type: "article" | "profile" | "website";
    siteName: string;
    title: string;
    description: string;
    url?: string;
    images: OgImage[];
  };
  twitter: {
    card: "summary" | "summary_large_image";
    title: string;
    description: string;
    images: OgImage[];
  };
}

/* ─── Text ───────────────────────────────────────────────────────────────── */

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Whitespace collapsed, at most `max` characters (the ellipsis included),
 * cut at a word boundary. Counted in code points so an emoji is never split
 * into half a surrogate pair.
 */
export function clampDescription(text: string, max = DESCRIPTION_MAX): string {
  const flat = collapseWhitespace(text);
  const chars = Array.from(flat);
  if (chars.length <= max) return flat;
  const head = chars.slice(0, max - 1).join("");
  const space = head.lastIndexOf(" ");
  // A single enormous word has no boundary worth keeping; cut it instead.
  const cut = space >= Math.floor(max / 2) ? head.slice(0, space) : head;
  return `${cut.replace(/[\s,;:.\-–—]+$/u, "")}…`;
}

/* ─── Images ─────────────────────────────────────────────────────────────── */

const CLOUDINARY_HOST = "res.cloudinary.com";
const CLOUD_PREFIX = "/dpynyht1l/";

const POST_TRANSFORMATION = "c_fill,g_auto,w_1200,h_630,f_jpg,q_auto:good";
const AVATAR_TRANSFORMATION = "c_fill,g_face,w_400,h_400,f_jpg,q_auto:good";

/**
 * A Cloudinary transformation segment: comma-separated `key_value` parts whose
 * keys are real transformation parameters. Keyed on the parameter list rather
 * than "letters then underscore" so a folder called `my_photos` is not
 * mistaken for one and dropped.
 */
const TRANSFORMATION_KEYS =
  "a|ac|af|ar|b|bo|br|c|co|cs|d|dl|dn|dpr|du|e|eo|f|fl|fn|fps|g|h|ki|l|o|p|pg|q|r|so|sp|t|u|vc|vs|w|x|y|z";
const TRANSFORMATION_SEGMENT = new RegExp(`^(?:${TRANSFORMATION_KEYS})_[^,]+(?:,(?:${TRANSFORMATION_KEYS})_[^,]+)*$`);

/** An issued upload key: optional version, `uploads/<owner>/`, folders, a file with an extension. No `%`, no `$`. */
const ISSUED_KEY = /^(?:v\d+\/)?uploads\/[A-Za-z0-9:_-]+\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.[A-Za-z0-9]{2,5}$/;

export type OgImageVariant = "post" | "avatar";

/**
 * A crawler-sized JPEG of an image or video on OUR Cloudinary cloud, or null.
 *
 * The URL must be https on exactly `res.cloudinary.com`, under our cloud, and
 * an `image/upload` or `video/upload` delivery. Look-alike hosts, other clouds,
 * credentials, ports, signed URLs (a changed transformation would break the
 * signature) and anything unparseable all come back null — the caller then
 * uses the branded fallback, never the raw URL.
 *
 * The EXISTING transformation is REPLACED, not appended to: the upload path
 * already carries `f_auto,q_auto,w_1280,c_limit`, and a second segment after
 * ours would re-limit the crop. A video becomes its first frame (`so_0`) as a
 * `.jpg`. The public id — colons in `did:privy:…` included — is kept exactly.
 *
 * WHAT IS LEFT MUST LOOK LIKE SOMETHING WE ISSUED. Stripping known
 * transformations is not enough on its own: a conditional (`if_w_gt_1`), a
 * variable (`$v_1`), a signature after a transformation, or an encoded slash
 * all survived it and were delivered behind ours. Every media URL the service
 * issues is `(v<n>/)uploads/<owner>/…/<file>.<ext>` — all nineteen sampled
 * from the production feed, images, clips and avatars — and it refuses post
 * media it did not issue, so anything else is refused here too.
 */
export function ogImageUrl(raw: unknown, variant: OgImageVariant): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== CLOUDINARY_HOST) return null;
  if (url.port !== "" || url.username !== "" || url.password !== "") return null;
  if (!url.pathname.startsWith(CLOUD_PREFIX)) return null;

  const [resource, delivery, ...rest] = url.pathname.slice(CLOUD_PREFIX.length).split("/");
  if ((resource !== "image" && resource !== "video") || delivery !== "upload") return null;
  if (rest.length === 0 || rest.some((segment) => segment.length === 0)) return null;
  if (rest[0].startsWith("s--")) return null;

  let start = 0;
  while (start < rest.length - 1 && TRANSFORMATION_SEGMENT.test(rest[start])) start += 1;
  const tail = rest.slice(start);
  // What remains has to be an asset we issued — see the header.
  if (!ISSUED_KEY.test(tail.join("/"))) return null;

  const base = variant === "avatar" ? AVATAR_TRANSFORMATION : POST_TRANSFORMATION;
  let transformation = base;
  if (resource === "video") {
    transformation = `so_0,${base}`;
    const last = tail.length - 1;
    tail[last] = /\.[A-Za-z0-9]{1,5}$/.test(tail[last])
      ? tail[last].replace(/\.[A-Za-z0-9]{1,5}$/, ".jpg")
      : `${tail[last]}.jpg`;
  }
  return `https://${CLOUDINARY_HOST}${CLOUD_PREFIX}${resource}/upload/${transformation}/${tail.join("/")}`;
}

/* ─── Parsing ────────────────────────────────────────────────────────────── */

const OgMediaSchema = z.object({ url: z.string(), kind: z.string() });

const OgPostSchema = z.object({
  kind: z.string(),
  text: z.string().nullable().optional().default(""),
  media: z.array(z.unknown()).optional(),
  mediaUrl: z.string().nullable().optional().default(null),
  mediaKind: z.string().nullable().optional().default(null),
  author: ProfileSchema.nullable().optional().default(null),
});

export interface OgPost {
  isStory: boolean;
  text: string;
  /** The post's own first picture or clip, in the author's order. */
  media: { url: string; kind: "image" | "video" } | null;
  authorName: string | null;
}

/** A name to print, or null. An id is never a name. */
function printableName(name: string | null | undefined): string | null {
  const trimmed = collapseWhitespace(name ?? "");
  if (!trimmed || trimmed.startsWith("did:")) return null;
  return trimmed;
}

function firstMedia(post: z.infer<typeof OgPostSchema>): OgPost["media"] {
  const items = post.media
    ? post.media.flatMap((item) => {
        const parsed = OgMediaSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : post.mediaUrl
      ? [{ url: post.mediaUrl, kind: post.mediaKind ?? "" }]
      : [];
  const found = items.find((item) => item.kind === "image" || item.kind === "video");
  return found ? { url: found.url, kind: found.kind as "image" | "video" } : null;
}

export function parseOgPost(data: unknown): OgPost | null {
  const parsed = OgPostSchema.safeParse(data);
  if (!parsed.success) return null;
  const post = parsed.data;
  return {
    isStory: post.kind === "story",
    text: post.text ?? "",
    media: firstMedia(post),
    authorName: printableName(post.author?.displayName),
  };
}

export interface OgProfile {
  name: string;
  /** `@handle`, or null when all the profile has is an id. */
  handle: string | null;
  /** The routing key to canonicalise on, when it is a real handle. */
  username: string | null;
  bio: string;
  avatarUrl: string | null;
}

export function parseOgProfile(data: unknown): OgProfile | null {
  const parsed = ProfileSchema.safeParse(data);
  if (!parsed.success) return null;
  const profile = parsed.data;
  const handle = atHandle(profile.username);
  return {
    name: printableName(profile.displayName) ?? SITE_NAME,
    handle,
    username: handle && isProfileUsername(profile.username) ? profile.username : null,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
  };
}

/* ─── Validation and switches ────────────────────────────────────────────── */

/** The service's own username rule. Anything else is never fetched. */
export function isProfileUsername(value: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

/**
 * `SHARE_PREVIEWS=off` (or false/0/no) turns every data-driven preview back
 * into the generic card, with no upstream request. Unset means on.
 */
export function sharePreviewsEnabled(value: string | undefined): boolean {
  return !/^(off|false|0|no|disabled)$/i.test((value ?? "").trim());
}

/* ─── Builders ───────────────────────────────────────────────────────────── */

function generic(url: string | undefined, title: string): ShareMetadata {
  return {
    title,
    description: SITE_DESCRIPTION,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      ...(url ? { url } : {}),
      images: [FALLBACK_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: SITE_DESCRIPTION,
      images: [FALLBACK_OG_IMAGE],
    },
  };
}

export function postPath(shortId: string): string {
  return sq(`/p/${shortId}`);
}

/** The card for a post we could not (or chose not to) read. */
export function genericPostMetadata(shortId: string): ShareMetadata {
  return generic(postPath(shortId), "Post");
}

export function buildPostMetadata(post: OgPost, shortId: string): ShareMetadata {
  if (post.isStory) return genericPostMetadata(shortId);
  const url = postPath(shortId);
  const title = post.authorName ? `${post.authorName} on ${SITE_NAME}` : `A post on ${SITE_NAME}`;
  const text = clampDescription(post.text);
  const description = text || (post.authorName ? `A post by ${post.authorName} on ${SITE_NAME}.` : SITE_DESCRIPTION);
  const mediaUrl = post.media ? ogImageUrl(post.media.url, "post") : null;
  const noun = post.media?.kind === "video" ? "Video" : "Photo";
  const image: OgImage = mediaUrl
    ? {
        url: mediaUrl,
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: post.authorName ? `${noun} from ${post.authorName}'s post` : `${noun} from a post on ${SITE_NAME}`,
      }
    : FALLBACK_OG_IMAGE;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: SITE_NAME, title, description, url, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export function profilePath(username: string): string {
  return sq(`/u/${username}`);
}

/** The card for a profile we could not (or chose not to) read. No canonical for an invalid handle. */
export function genericProfileMetadata(username: string | null): ShareMetadata {
  return generic(username && isProfileUsername(username) ? profilePath(username) : undefined, "Profile");
}

export function buildProfileMetadata(profile: OgProfile, requested: string): ShareMetadata {
  const url = profilePath(profile.username ?? requested);
  const title = profile.handle
    ? `${profile.name} (${profile.handle}) on ${SITE_NAME}`
    : `${profile.name} on ${SITE_NAME}`;
  const description = clampDescription(profile.bio) || `${profile.name} is on ${SITE_NAME}.`;
  const avatar = ogImageUrl(profile.avatarUrl, "avatar");
  const image: OgImage = avatar
    ? { url: avatar, width: 400, height: 400, type: "image/jpeg", alt: `${profile.name}'s profile photo` }
    : FALLBACK_OG_IMAGE;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", siteName: SITE_NAME, title, description, url, images: [image] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

/* ─── Deciding ───────────────────────────────────────────────────────────── */

/**
 * What `/p/[id]` publishes for an already-validated post. `result` null means
 * previews are switched off. Only an upstream 404 is `not-found`; everything
 * else that is not a readable post is the generic card.
 */
export function postMetadataFor(result: OgFetchResult | null, shortId: string): ShareMetadata | "not-found" {
  if (!result) return genericPostMetadata(shortId);
  if (result.status === "not-found") return "not-found";
  const post = result.status === "ok" ? parseOgPost(result.data) : null;
  return post ? buildPostMetadata(post, shortId) : genericPostMetadata(shortId);
}

/** The same decision for `/u/[username]`, whose handle has already passed `isProfileUsername`. */
export function profileMetadataFor(result: OgFetchResult | null, username: string): ShareMetadata | "not-found" {
  if (!result) return genericProfileMetadata(username);
  if (result.status === "not-found") return "not-found";
  const profile = result.status === "ok" ? parseOgProfile(result.data) : null;
  return profile ? buildProfileMetadata(profile, username) : genericProfileMetadata(username);
}
