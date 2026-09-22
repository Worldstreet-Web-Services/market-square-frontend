import { safePhoto } from "./wink-card.ts";

/**
 * THE PROFILE SHARE CARD AS A PICTURE — node 1624:21811.
 *
 * The "Share Profile" modal shows a card (the person's photo, name, handle, a
 * QR to their profile, and "Follow on Square"), and its Download and Share hand
 * over that same card as an image. So the modal renders `/api/profile-card`
 * straight into an `<img>` and Download/Share point at the identical URL — the
 * preview IS the saved picture, exactly as the wink card works.
 *
 * This module is the shared contract: the modal builds the query, the route
 * reads it back. Every parameter is hostile (it is a URL anybody can edit into
 * an image that looks like ours), so the photo is `https:`-only and never a
 * private address (`safePhoto`, reused from the wink card — the route fetches
 * it server-side, an SSRF target), the text is collapsed and capped, and the
 * variant is clamped to the carousel's range.
 */

/**
 * The card designs the modal's dots switch between. Two are built so far —
 * 0: the full-bleed photo card (1583:18266), 1: the big rounded-QR card
 * (1621:20437). Raise this as the remaining Figma variants land.
 */
export const PROFILE_CARD_VARIANTS = 2;

const TEXT_MAX = 60;
const URL_MAX = 512;
const ID_MAX = 200;

function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export interface ProfileCardInput {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Stable identity (`profile.id`) — seeds the same mascot the app shows when
   *  there is no upload. */
  seed?: string | null;
  verified?: boolean;
  /** The profile URL the QR encodes and the card points at. */
  url: string;
  /** 0..PROFILE_CARD_VARIANTS-1 — which background the reader picked. */
  variant?: number;
}

export function profileCardQuery(input: ProfileCardInput): string {
  const params = new URLSearchParams({
    u: input.username,
    n: input.displayName,
    url: input.url,
  });
  if (input.avatarUrl) params.set("a", input.avatarUrl);
  if (input.seed) params.set("s", input.seed);
  if (input.verified) params.set("vf", "1");
  if (input.variant) params.set("v", String(input.variant));
  return params.toString();
}

export interface ProfileCard {
  username: string;
  /** The name on the card — display name, else username. */
  name: string;
  /** The person's own upload, `https:` only, else null (falls back to the seed). */
  photo: string | null;
  /** Stable identity for the seeded mascot when there is no upload. */
  seed: string;
  verified: boolean;
  /** The https/http URL the QR encodes; empty when the query carried none. */
  url: string;
  variant: number;
}

/** The QR points at a real address, and only ever an http(s) one. */
function safeUrl(value: string | null | undefined): string | null {
  const raw = clean(value, URL_MAX);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The route's half: the query back into what the card draws, or null when it names nobody. */
export function parseProfileCard(params: URLSearchParams): ProfileCard | null {
  const username = clean(params.get("u"), TEXT_MAX);
  const name = clean(params.get("n"), TEXT_MAX) || username;
  // A card about nobody is not a card.
  if (!name) return null;
  const rawVariant = Number(params.get("v"));
  const variant =
    Number.isInteger(rawVariant) && rawVariant >= 0 && rawVariant < PROFILE_CARD_VARIANTS ? rawVariant : 0;
  return {
    username,
    name,
    photo: safePhoto(params.get("a")),
    seed: clean(params.get("s"), ID_MAX),
    verified: params.get("vf") === "1",
    url: safeUrl(params.get("url")) ?? "",
    variant,
  };
}

/** A file name safe in a `content-disposition` header and on every OS. */
export function profileCardFileName(username: string): string {
  const slug = username.toLowerCase().replace(/[^a-z0-9_-]+/g, "").slice(0, TEXT_MAX);
  return `square-profile-${slug || "card"}.png`;
}

/** The five card backgrounds — a soft accent glow per the carousel dot. */
export const PROFILE_CARD_ACCENTS: readonly string[] = [
  "#7E3BEB", // purple (the file's own)
  "#2F6BFF", // blue
  "#E8B74A", // gold
  "#3BC57E", // green
  "#F0568C", // pink
];
