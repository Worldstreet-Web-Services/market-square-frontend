/**
 * EVERY ADDRESS THE SQUARE HAS EVER HANDED OUT KEEPS WORKING.
 *
 * Moving the app under `/square` changes every URL. Links already in the world
 * — a post shared to WhatsApp as `square.tsionark.com/p/<id>`, a profile
 * bookmarked as `/u/<name>`, a room invite, the preview cards already posted —
 * would all 404 the moment it ships. So each top-level route that moved gets a
 * redirect from where it was to where it is, and the front page `/` goes to
 * `/square`.
 *
 * ─── EXPLICIT, NOT A CATCH-ALL ───────────────────────────────────────────────
 * A single `/:path*` rule would also catch `/_next/*`, the image optimiser and
 * `/square` itself — a redirect loop or a broken stylesheet waiting for the
 * next Next upgrade. Naming the routes that moved cannot touch anything else,
 * and `lib/legacy-routes.test.ts` fails if this list ever drifts from the
 * directories actually under `app/square/`, so a route added later cannot ship
 * without its redirect.
 *
 * ─── TEMPORARY (307), DELIBERATELY ───────────────────────────────────────────
 * A permanent redirect is cached hard by browsers, so if the move ever had to be
 * rolled back, every reader who had followed one would stay stranded at
 * `/square/…`. 307 is reversible and, like 308, keeps a POST a POST — which
 * matters for `/api/*`, where a stale tab still holding old JavaScript posts to
 * the old endpoint. Promote to permanent once the move has settled.
 *
 * Query strings pass through a Next redirect untouched, which is what keeps the
 * cross-product share contract `/?compose=1&link=…` intact across the hop.
 *
 * These only ever run on a host that sends the old paths to THIS app —
 * `square.tsionark.com`. On `www.tsionark.com` those paths belong to WSWS and
 * never reach the Square, so nothing here can take a WSWS route.
 */

import { SQUARE_BASE } from "./square-path.ts";

/** The top-level routes that moved into `app/square/`. `api` is handled on its own. */
export const LEGACY_ROUTES = [
  "admin",
  "arkmarks",
  "auth",
  "code",
  "discover",
  "feed",
  "gist-rooms",
  "houses",
  "join",
  "live",
  "messages",
  "notifications",
  "operations",
  "p",
  "pals",
  "schedule",
  "share-card",
  "spotlight",
  "store",
  "studio",
  "t",
  "tickets",
  "u",
  "unsubscribe",
] as const;

export interface LegacyRedirect {
  source: string;
  destination: string;
  permanent: false;
}

export function legacyRedirects(): LegacyRedirect[] {
  const to = (path: string) => `${SQUARE_BASE}${path}`;
  const rules: LegacyRedirect[] = [
    // The front page. Its query (`?compose=1&link=…`) is carried by Next.
    { source: "/", destination: SQUARE_BASE, permanent: false },
  ];
  for (const route of LEGACY_ROUTES) {
    rules.push({ source: `/${route}`, destination: to(`/${route}`), permanent: false });
    rules.push({ source: `/${route}/:rest*`, destination: to(`/${route}/:rest*`), permanent: false });
  }
  // The BFF. A stale tab posting to the old endpoint keeps its method and body.
  rules.push({ source: "/api/:rest*", destination: to("/api/:rest*"), permanent: false });
  return rules;
}
