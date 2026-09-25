import "server-only";
import { cache } from "react";
import { isUuid } from "../short-id.ts";
import { isProfileUsername, sharePreviewsEnabled } from "../og-metadata.ts";
import { fetchOgJson, type OgFetchResult } from "./og-fetch.ts";
import { marketSquareBase } from "./upstream-base.ts";
import { upstreamIsOpen } from "./upstream-health.ts";

/**
 * The two upstream reads behind share previews — thin on purpose; every rule
 * lives in `og-fetch.ts` and `lib/og-metadata.ts` where it is tested.
 *
 * VALIDATED BEFORE ANY URL IS BUILT, AND ENCODED ANYWAY. These reads never pass
 * through the BFF's `isSafePath`, and Next hands a route param over already
 * decoded, so `..\..\kash\balances` would otherwise normalise into a different
 * service's path. The routes validate first; the checks here repeat it so no
 * future caller can skip it, and `encodeURIComponent` is the last line.
 *
 * `cache()` makes the read once per request however many times metadata asks.
 * Nothing is cached across requests — see `og-fetch.ts` for why a removed
 * post's preview must never be served from a cache.
 */

const UNAVAILABLE: OgFetchResult = { status: "unavailable" };

/** Server-only kill switch — see `.env.example`. */
export function sharePreviewsOn(): boolean {
  return sharePreviewsEnabled(process.env.SHARE_PREVIEWS);
}

async function read(path: string): Promise<OgFetchResult> {
  const base = marketSquareBase();
  // Fixture mode has no service to ask; an open breaker means this instance
  // already knows the answer would be a timeout.
  if (!base || upstreamIsOpen()) return UNAVAILABLE;
  return fetchOgJson(`${base}${path}`);
}

export const loadOgPost = cache(async (uuid: string): Promise<OgFetchResult> => {
  if (!isUuid(uuid)) return UNAVAILABLE;
  return read(`/posts/${encodeURIComponent(uuid.toLowerCase())}`);
});

export const loadOgProfile = cache(async (username: string): Promise<OgFetchResult> => {
  if (!isProfileUsername(username)) return UNAVAILABLE;
  return read(`/profiles/${encodeURIComponent(username)}`);
});

/**
 * A GIST ROOM, for the card its link unfurls into.
 *
 * Shared to Telegram or WhatsApp, a room link was showing the app's generic
 * "Square" preview — no name, no time, no host — because this page had no
 * metadata of its own (ogazboiz, 2026-09-24: "i share the card to telegram
 * but i did not see the card ... and i cant even see the card itself").
 *
 * The same `isUuid` guard as a post, for the same reason: a route param
 * arrives decoded, so a traversal would otherwise normalise into another
 * service's path.
 */
export const loadOgRoom = cache(async (id: string): Promise<OgFetchResult> => {
  if (!isUuid(id)) return UNAVAILABLE;
  return read(`/streams/${encodeURIComponent(id.toLowerCase())}`);
});
