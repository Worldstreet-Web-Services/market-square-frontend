import { artworkForSeed, resolveSeed } from "./avatar-seed.ts";
import {
  friendsMomentCopy,
  friendsMomentLabels,
  type FriendsMomentCopy,
  type FriendsMomentKind,
} from "./friends-popup.ts";

/**
 * THE WINK CARD AS A PICTURE — what the popup's Download and Share hand over.
 *
 * The saved image has to BE the card the reader is looking at: "it suppose to
 * be exactly like the wink card". It used to be a composition of its own — a
 * heart, one square initial, a single line of text — and the moment somebody
 * saved it, it read as a different thing from the card they had tapped.
 *
 * So the popup and `/api/wink-card` share this module. The popup writes the
 * query from the moment it is showing; the route reads it back into the SAME
 * copy (`friendsMomentCopy`), the same button labels (`friendsMomentLabels`)
 * and the same avatar the popup's `Avatar` resolves. Nothing about what the
 * card says is decided twice.
 *
 * ─── EVERY PARAMETER IS HOSTILE ─────────────────────────────────────────────
 * The query is a URL anybody can edit, and the result is an image that looks
 * like it came from us. The kind is an allowlist (unknown reads as the
 * smallest claim, a first wink, never a match the URL invented), text is
 * whitespace-collapsed and length-capped, and a photo must be `https:` at a
 * public address or it is dropped for the seeded artwork — the route fetches
 * that photo from our own server, so the host is an SSRF target and not
 * merely a link. See `isPrivateHost`.
 */

export interface WinkCardPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface WinkCardInput {
  kind: FriendsMomentKind;
  other: WinkCardPerson & { isFollowing?: boolean };
  viewer: WinkCardPerson;
}

export interface WinkCardFace {
  /** The name on the card — display name, else username. */
  name: string;
  /** The person's own upload, `https:` only. */
  photo: string | null;
  /** The seeded mascot the popup's `Avatar` shows when there is no upload. */
  artwork: string | null;
}

export interface WinkCard {
  /** The other person's username — what the saved file is named after. */
  username: string;
  copy: FriendsMomentCopy;
  labels: { primary: string; secondary: string | null };
  other: WinkCardFace;
  viewer: WinkCardFace;
}

const KINDS: readonly FriendsMomentKind[] = ["friends", "mutual-wink", "wink"];
/** Long enough for a real display name, short enough not to be a billboard. */
export const WINK_CARD_TEXT_MAX = 40;
const ID_MAX = 200;

function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Hosts a server-side fetch must never be aimed at.
 *
 * `/api/wink-card` FETCHES the photo named in its own query string, so the
 * host in that URL is chosen by whoever opens the link — and a fetch made by
 * our server reaches what the open internet cannot: the cloud metadata
 * endpoint on 169.254.169.254, a database on 10.x, anything bound to
 * localhost. That is SSRF, and `https:` is no defence against it — a private
 * address serves TLS perfectly well.
 *
 * Blocked by ADDRESS rather than by an allowlist of CDNs, deliberately:
 * avatars legitimately come from hosts this repo does not enumerate, and a
 * guessed allowlist breaks real pictures the day somebody changes storage.
 *
 * A DNS name that RESOLVES to a private address is out of scope here — that
 * needs the address at connect time, which `fetch` does not expose. This
 * closes the literal-address hole, which is the one anybody can use straight
 * from a browser's address bar.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  // IPv6 loopback and the unspecified address, then unique-local (fc00::/7)
  // and link-local (fe80::/10).
  if (host === "::" || host === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return true;
  // IPv4-mapped IPv6 — `::ffff:127.0.0.1`, which the URL parser normalises to
  // `::ffff:7f00:1`. Both spellings name the same address.
  let v4 = host;
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (dotted) v4 = dotted[1]!;
  else if (hex) {
    const high = parseInt(hex[1]!, 16);
    const low = parseInt(hex[2]!, 16);
    v4 = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  const parts = v4.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return false;
  const [a, b] = parts.map(Number);
  // 0.0.0.0/8, loopback, RFC1918 and link-local. The URL parser has already
  // normalised `0x7f000001` and `2130706433` to dotted form by this point.
  if (a === 0 || a === 127 || a === 10) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Only an https image, and never one aimed at a private address. */
export function safePhoto(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    // The route fetches this URL server-side, so the host is an SSRF target
    // rather than just a link. See `isPrivateHost`.
    if (isPrivateHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The query the popup puts on `/api/wink-card` for the moment it is showing. */
export function winkCardQuery({ kind, other, viewer }: WinkCardInput): string {
  const params = new URLSearchParams({
    k: kind,
    oi: other.id,
    ou: other.username,
    on: other.displayName,
    vi: viewer.id,
    vu: viewer.username,
    vn: viewer.displayName,
  });
  if (other.avatarUrl) params.set("oa", other.avatarUrl);
  if (viewer.avatarUrl) params.set("va", viewer.avatarUrl);
  if (other.isFollowing) params.set("of", "1");
  return params.toString();
}

function readPerson(params: URLSearchParams, prefix: "o" | "v") {
  const id = clean(params.get(`${prefix}i`), ID_MAX);
  const username = clean(params.get(`${prefix}u`), WINK_CARD_TEXT_MAX);
  // The popup's own rule: display name, else username.
  const name = clean(params.get(`${prefix}n`), WINK_CARD_TEXT_MAX) || username || "Someone";
  const photo = safePhoto(params.get(`${prefix}a`));
  // Seeded exactly as the popup's <Avatar name seed={id}> seeds it — id, then
  // name — or the saved card would carry a different mascot from the screen.
  const artwork = artworkForSeed(resolveSeed({ id, name }));
  return { id, username, face: { name, photo, artwork } satisfies WinkCardFace };
}

/**
 * The card link's FIRST shape, `?name&handle&avatar`, read as the first wink it
 * always drew. A page loaded before the link changed still sends it, and links
 * already shared carry it; read any other way they draw nobody.
 */
function upgradeLegacy(params: URLSearchParams): URLSearchParams {
  if (params.has("k") || !(params.has("name") || params.has("handle"))) return params;
  const upgraded = new URLSearchParams({ k: "wink", on: params.get("name") ?? "", ou: params.get("handle") ?? "" });
  const avatar = params.get("avatar");
  if (avatar) upgraded.set("oa", avatar);
  return upgraded;
}

/**
 * The route's half: the query back into what the card draws — or null when
 * it names nobody. A card about nobody is not a card; drawing "Someone" is
 * what hid a link that had lost its person.
 */
export function parseWinkCard(query: URLSearchParams): WinkCard | null {
  const params = upgradeLegacy(query);
  if (!clean(params.get("ou"), WINK_CARD_TEXT_MAX) && !clean(params.get("on"), WINK_CARD_TEXT_MAX)) return null;
  const raw = params.get("k");
  const kind = KINDS.find((known) => known === raw) ?? "wink";
  const other = readPerson(params, "o");
  const viewer = readPerson(params, "v");
  const copy = friendsMomentCopy(
    {
      kind,
      actor: {
        id: other.id,
        username: other.username,
        displayName: other.face.name,
        avatarUrl: other.face.photo,
        isFollowing: params.get("of") === "1",
      },
      notificationIds: [],
    },
    other.face.name
  );
  return {
    username: other.username,
    copy,
    labels: friendsMomentLabels(copy, other.face.name),
    other: other.face,
    viewer: viewer.face,
  };
}

/** A file name safe in a `content-disposition` header and on every OS. */
export function winkCardFileName(username: string): string {
  const slug = username.toLowerCase().replace(/[^a-z0-9_-]+/g, "").slice(0, WINK_CARD_TEXT_MAX);
  return `square-wink-${slug || "card"}.png`;
}
