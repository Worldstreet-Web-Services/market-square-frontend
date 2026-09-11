/**
 * UTM TAGS — where a visit to Square came from.
 *
 * Two halves, both standard campaign tagging:
 *
 *   · OUTBOUND. Every link somebody shares out of Square carries
 *     `utm_source` (which app it went to), `utm_medium` (`social` for a
 *     platform, `share` for a copied link or the device's own sheet) and
 *     `utm_campaign` (what was shared — a post, a profile, a house invite), so
 *     the people who arrive through it can be counted.
 *   · INBOUND. The first set of tags a visit arrives with is kept for that
 *     visit and sent along with its analytics events (`lib/analytics.ts`).
 *
 * Pure, so `node --test` pins it.
 */

import type { ShareTarget } from "./share-targets.ts";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

export interface UtmTags {
  source: string;
  medium: string;
  campaign: string;
}

/** What was shared, as a campaign name. */
export type ShareCampaign = "post_share" | "profile_share" | "house_invite";

/** Where a share went: one of the apps, a copied link, or the device's share sheet. */
export type ShareChannel = ShareTarget | "copy_link" | "native_share";

export function shareTags(channel: ShareChannel, campaign: ShareCampaign): UtmTags {
  const medium = channel === "copy_link" || channel === "native_share" ? "share" : "social";
  return { source: channel, medium, campaign };
}

/**
 * The URL with its UTM tags set — replacing any it already carried, keeping
 * every other parameter and the #fragment. A string that is not an absolute
 * URL comes back untouched rather than mangled.
 */
export function withUtm(url: string, tags: UtmTags): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  parsed.searchParams.set("utm_source", tags.source);
  parsed.searchParams.set("utm_medium", tags.medium);
  parsed.searchParams.set("utm_campaign", tags.campaign);
  return parsed.toString();
}

/** The UTM tags on a query string, trimmed and capped, or null when there are none. */
export function readUtm(search: string): UtmParams | null {
  const params = new URLSearchParams(search);
  const found: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) found[key] = value.slice(0, 100);
  }
  return Object.keys(found).length > 0 ? found : null;
}
