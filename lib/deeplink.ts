// Resolves a backend deep link { kind, ref } to a destination. Internal kinds
// route inside this app; Ark platform kinds route to the main Ark app.

export interface DeepLink {
  kind: string;
  ref: string;
}

const ARK_APP_BASE = process.env.NEXT_PUBLIC_ARK_APP_URL ?? "https://app.worldstreet.com";

export interface ResolvedLink {
  href: string;
  external: boolean;
  label: string;
}

export function resolveDeepLink(link: DeepLink): ResolvedLink {
  switch (link.kind) {
    case "stream":
      return { href: `/live/${link.ref}`, external: false, label: "Watch" };
    case "store_item":
      return { href: `/store/${link.ref}`, external: false, label: "Open" };
    case "profile":
      return { href: `/u/${link.ref}`, external: false, label: "View profile" };
    case "listing":
      return { href: `${ARK_APP_BASE}/listings/${link.ref}`, external: true, label: "View listing" };
    case "market":
      return { href: `${ARK_APP_BASE}/markets/${link.ref}`, external: true, label: "Open market" };
    case "game":
      return { href: `${ARK_APP_BASE}/games/${link.ref}`, external: true, label: "Play" };
    case "external":
      return { href: link.ref, external: true, label: "Open link" };
    default:
      return { href: `${ARK_APP_BASE}/${link.ref}`, external: true, label: "Open" };
  }
}
