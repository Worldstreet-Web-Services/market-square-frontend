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
 * whitespace-collapsed and length-capped, and a photo must be `https:` or it
 * is dropped for the seeded artwork.
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

/** Only an https image — anything else is not drawn. */
export function safePhoto(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
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
