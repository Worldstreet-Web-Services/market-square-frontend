/**
 * WHERE A VISIT TO SQUARE CAME FROM — in two characters, not sixty-two.
 *
 * Shared links used to carry three UTM parameters:
 * `?utm_source=whatsapp&utm_medium=social&utm_campaign=post_share` is 62 of the
 * 128 characters in a shared post link. The best apps do not do this: X adds
 * `?s=NN` and expands it on its own side. So an outbound link now carries ONE
 * short channel code (`?s=wa`), and everything the three tags said is rebuilt
 * on arrival:
 *
 *   · source and medium come from the code (`wa` → whatsapp, social);
 *   · the campaign comes from WHERE THE LINK LANDS — a post link opens `/p/`,
 *     a profile `/u/`, a house invite `/join/`, a room `/gist-rooms/` — so it
 *     never needed to travel in the URL at all.
 *
 * INBOUND STILL READS FULL UTM TAGS. Email digests (built by the service) carry
 * them, and a link somebody hand-tagged should still count. When both are
 * present the explicit tags win.
 *
 * Analytics is inert today: `POST /analytics/events` has no route on the
 * service and the client stops after its first 404 (`lib/analytics.ts`). This
 * keeps attribution intact for the day the collector exists.
 *
 * Pure, so `node --test` pins it.
 */

import type { ShareTarget } from "./share-targets.ts";
import { stripSquare } from "./square-path.ts";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

/** What was shared, as a campaign name — derived from the landing path. */
export type ShareCampaign = "post_share" | "profile_share" | "house_invite" | "room_share";

/** Where a share went: one of the apps, a copied link, or the device's share sheet. */
export type ShareChannel = ShareTarget | "copy_link" | "native_share";

/** The query key. One letter: it is the only thing a shared link still carries. */
export const SHARE_CHANNEL_KEY = "s";

export const SHARE_CHANNEL_CODES: Record<ShareChannel, string> = {
  whatsapp: "wa",
  x: "x",
  facebook: "fb",
  telegram: "tg",
  copy_link: "cp",
  native_share: "sh",
};

const CHANNEL_BY_CODE = new Map(
  Object.entries(SHARE_CHANNEL_CODES).map(([channel, code]) => [code, channel as ShareChannel])
);

/** `social` for a platform, `share` for a copied link or the device sheet. */
export function channelMedium(channel: ShareChannel): "social" | "share" {
  return channel === "copy_link" || channel === "native_share" ? "share" : "social";
}

/** The campaign a landing path implies, or null for a path nothing is shared as. */
export function campaignForPath(rawPathname: string): ShareCampaign | null {
  // Logical route: a landing URL carries /square since the move.
  const pathname = stripSquare(rawPathname);
  if (pathname.startsWith("/p/")) return "post_share";
  if (pathname.startsWith("/u/")) return "profile_share";
  if (pathname.startsWith("/join/")) return "house_invite";
  if (pathname.startsWith("/gist-rooms/")) return "room_share";
  return null;
}

/**
 * The link with its one channel code set — replacing an existing code and
 * dropping any UTM tags it carried, keeping every other parameter and the
 * #fragment. A string that is not an absolute URL comes back untouched.
 */
export function withShareChannel(url: string, channel: ShareChannel): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  for (const key of UTM_KEYS) parsed.searchParams.delete(key);
  parsed.searchParams.set(SHARE_CHANNEL_KEY, SHARE_CHANNEL_CODES[channel]);
  return parsed.toString();
}

/**
 * Where this visit came from, or null.
 *
 * Explicit UTM tags (trimmed, capped at 100) win. Otherwise a KNOWN channel
 * code becomes source + medium, with the campaign from the landing path when
 * that path is one we share. An unknown code is ignored rather than recorded.
 */
export function readUtm(search: string, pathname = ""): UtmParams | null {
  const params = new URLSearchParams(search);
  const found: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) found[key] = value.slice(0, 100);
  }
  if (Object.keys(found).length > 0) return found;

  const channel = CHANNEL_BY_CODE.get(params.get(SHARE_CHANNEL_KEY)?.trim() ?? "");
  if (!channel) return null;
  const campaign = campaignForPath(pathname);
  return {
    utm_source: channel,
    utm_medium: channelMedium(channel),
    ...(campaign ? { utm_campaign: campaign } : {}),
  };
}

/**
 * The same URL without the channel code, or null when it has none.
 *
 * Read once, then removed from the address bar: left there, a link copied
 * from the bar would re-share `?s=wa` as though it had come from WhatsApp
 * again, and the code would be credited to a channel that did not send it.
 */
export function withoutShareChannel(href: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }
  if (!parsed.searchParams.has(SHARE_CHANNEL_KEY)) return null;
  parsed.searchParams.delete(SHARE_CHANNEL_KEY);
  return parsed.toString();
}
