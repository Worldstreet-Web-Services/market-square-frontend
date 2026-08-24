// Resolves a backend deep link { kind, ref } to a destination. Internal kinds
// route inside this app; Ark platform kinds route to the main Ark app.

export interface DeepLink {
  kind: string;
  ref: string;
}

/**
 * Where the OTHER Ark products live.
 *
 * There is no verified public origin for the Ark app today: the previous
 * default, `https://app.worldstreet.com`, resolves in DNS but serves nothing,
 * and the backend's own host (`worldstreetwebservices.com`) is the API
 * gateway, not a browser destination. Guessing between them would just move
 * the broken link, so the base is configuration: set `NEXT_PUBLIC_ARK_APP_URL`
 * to the deployed Ark app and every cross-product link lights up at once.
 *
 * With it unset, `arkAppConfigured()` is false and callers render those rows
 * inert rather than pointing a reader at a page that does not answer.
 */
const ARK_APP_BASE = (process.env.NEXT_PUBLIC_ARK_APP_URL ?? "").replace(/\/+$/, "");

export function arkAppConfigured(): boolean {
  return ARK_APP_BASE.length > 0;
}

// A blank ref used to produce ".../listings/" — a trailing slash into a
// section index that does not exist. An empty ref means "the section", so the
// segment is simply omitted.
function arkUrl(section: string, ref: string): string {
  return ref ? `${ARK_APP_BASE}/${section}/${ref}` : `${ARK_APP_BASE}/${section}`;
}

export interface ResolvedLink {
  href: string;
  external: boolean;
  label: string;
  /**
   * False when the destination lives in an Ark product whose base URL is not
   * configured. Callers must not render a CTA for an unavailable link — there
   * is nowhere for it to go, and a link into nowhere is worse than no link.
   */
  available: boolean;
}

export function resolveDeepLink(link: DeepLink, source?: string): ResolvedLink {
  const internal = (href: string, label: string): ResolvedLink => ({
    href: source ? `${href}${href.includes("?") ? "&" : "?"}source=${encodeURIComponent(source)}` : href,
    external: false,
    label,
    available: true,
  });
  const ark = (section: string, label: string): ResolvedLink => ({
    href: arkUrl(section, link.ref),
    external: true,
    label,
    available: arkAppConfigured(),
  });
  switch (link.kind) {
    case "stream":
      return internal(`/live/${link.ref}`, "Watch");
    case "store_item":
      return internal(`/store/${link.ref}`, "Open");
    case "profile":
      return internal(`/u/${link.ref}`, "View profile");
    case "listing":
      return ark("listings", "View listing");
    case "market":
      return ark("markets", "Open market");
    case "game":
      return ark("games", "Play");
    case "external":
      // An `external` ref is a full URL supplied by the author, so it stands
      // on its own and never needs the Ark base.
      return { href: link.ref, external: true, label: "Open link", available: /^https?:\/\//i.test(link.ref) };
    default:
      return { href: `${ARK_APP_BASE}/${link.ref}`, external: true, label: "Open", available: arkAppConfigured() };
  }
}

/**
 * The CTA form: a link, or nothing.
 *
 * Surfaces render a deep-link CTA only when it actually leads somewhere, so
 * every caller goes through this rather than through `resolveDeepLink`
 * directly. An unresolvable Ark link disappears instead of becoming a button
 * into a host that answers nothing.
 */
export function resolveCta(link: DeepLink | null | undefined, source?: string): ResolvedLink | null {
  if (!link) return null;
  const resolved = resolveDeepLink(link, source);
  return resolved.available ? resolved : null;
}
