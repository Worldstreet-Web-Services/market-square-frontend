import type { DeepLink } from "@/lib/deeplink";

/**
 * The cross-product share contract: `/?compose=1&link=<kind>:<ref>`.
 *
 * Ark products (trade, vault, chess, prediction, the store) send someone here
 * with the composer already open and the thing they did attached. It is a
 * PREFILL, never an auto-post — the person sees the draft, edits it and
 * publishes it themselves. Their voice, their choice, their post.
 *
 * Why a link parameter rather than an event: the platform events those
 * products already publish carry WALLET ADDRESSES, not Market Square user ids,
 * so nothing consumed off the broker can be attributed to a profile. A prefill
 * sidesteps that entirely — the sharer is the authenticated caller, so
 * authorship is settled before the request is made, and no other team has to
 * change an event payload for this to work.
 *
 * EVERY value here arrives from a URL somebody else composed, so it is treated
 * as hostile: the kind is an allowlist, `external` is http(s) only, and every
 * field is length-capped. A link parameter that does not validate yields null
 * and the composer simply opens empty — a bad share must never become a
 * blocked composer, and must never become a link the reader would not have
 * followed knowingly.
 */

/** Kinds a share may target. Deliberately narrower than `resolveDeepLink`. */
const SHAREABLE_KINDS = ["stream", "store_item", "profile", "listing", "market", "game", "external"] as const;

type ShareableKind = (typeof SHAREABLE_KINDS)[number];

function isShareableKind(value: string): value is ShareableKind {
  return (SHAREABLE_KINDS as readonly string[]).includes(value);
}

/** Refs are ids or URLs; anything longer is not one of those. */
const MAX_REF = 2048;
/** The composer's own limit governs the post; this only bounds the URL. */
const MAX_TEXT = 500;
const MAX_LABEL = 120;

/**
 * `javascript:` and `data:` URLs are the reason this function exists.
 *
 * An `external` ref becomes an anchor `href`. Without a scheme check,
 * `?link=external:javascript:…` is stored XSS the moment the post is
 * published — the author would be handing every reader a script link wearing
 * their name. `new URL` also rejects the protocol-relative `//host` form,
 * which would otherwise resolve off-origin.
 */
function isSafeExternal(ref: string): boolean {
  try {
    const url = new URL(ref);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export interface ComposePrefill {
  link: DeepLink | null;
  label: string | null;
  text: string | null;
}

/**
 * Splits `<kind>:<ref>` on the FIRST colon only.
 *
 * An external ref is a URL and contains its own colons, so splitting on all of
 * them truncates `https://x/y` to `https`.
 */
function splitTarget(raw: string): { kind: string; ref: string } | null {
  const colon = raw.indexOf(":");
  if (colon <= 0 || colon === raw.length - 1) return null;
  return { kind: raw.slice(0, colon), ref: raw.slice(colon + 1) };
}

export function parseComposePrefill(params: {
  link: string | null;
  label: string | null;
  text: string | null;
}): ComposePrefill {
  const text = params.text?.trim() ? params.text.trim().slice(0, MAX_TEXT) : null;
  const label = params.label?.trim() ? params.label.trim().slice(0, MAX_LABEL) : null;

  if (!params.link) return { link: null, label: null, text };

  const target = splitTarget(params.link.trim());
  if (!target) return { link: null, label: null, text };

  const { kind, ref } = target;
  if (!isShareableKind(kind)) return { link: null, label: null, text };
  if (ref.length > MAX_REF) return { link: null, label: null, text };
  if (kind === "external" && !isSafeExternal(ref)) return { link: null, label: null, text };

  // A label is only meaningful next to a link; on its own it would put text
  // the sharer never wrote into a chip they cannot see the source of.
  return { link: { kind, ref }, label, text };
}
