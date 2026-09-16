/**
 * WHERE THE SQUARE LIVES: `www.tsionark.com/square`.
 *
 * The Square is served as a Vercel microfrontend beside WSWS, which owns the
 * rest of the domain. Every route, BFF endpoint and public file therefore sits
 * under one prefix — and because `withMicrofrontends` does NOT support Next's
 * `basePath` (Vercel's quickstart says so outright), the prefix is real: routes
 * live in `app/square/`, files in `public/square/`, and every address the app
 * writes has to carry it. These helpers are the only place that knows the
 * prefix, so it is spelled once.
 *
 * ─── THREE KINDS OF PATH, NEVER CONFUSED ─────────────────────────────────────
 *  · `sq`    — a ROUTE the reader navigates to: `/feed` → `/square/feed`.
 *  · `asset` — a file in `public/`: `/logo.svg` → `/square/logo.svg`.
 *  · `api`   — a BFF endpoint of THIS app: `/api/kash` → `/square/api/kash`.
 *
 * What is deliberately NOT here: the paths handed to `msApi` (`/me`,
 * `/streams`, `/spotlight`, …). Those name the UPSTREAM service, travel inside
 * the BFF, and never reach the browser's address bar — prefixing one would
 * break every API call. A name like `/spotlight` is both a route and an API
 * path, which is exactly why the kind is chosen at the call site and never
 * guessed from the first segment.
 *
 * ─── EVERY HELPER IS IDEMPOTENT AND LEAVES FOREIGN ADDRESSES ALONE ───────────
 * An absolute URL, a protocol-relative `//host`, a bare `#hash` or `?query`,
 * and a path that already carries the prefix all come back unchanged. So
 * wrapping twice is harmless, and a helper can never turn somebody's external
 * link into a broken local one.
 *
 * Pure and alias-free, so `node --test` pins it.
 */

export const SQUARE_BASE = "/square";

/** Not a root path this app owns: an absolute URL, `//host`, `#hash`, `?query`, or empty. */
function isForeign(path: string): boolean {
  return !path.startsWith("/") || path.startsWith("//");
}

/** Already under the prefix: `/square`, `/square/…`, `/square?…`, `/square#…`. */
function isPrefixed(path: string): boolean {
  return (
    path === SQUARE_BASE ||
    path.startsWith(`${SQUARE_BASE}/`) ||
    path.startsWith(`${SQUARE_BASE}?`) ||
    path.startsWith(`${SQUARE_BASE}#`)
  );
}

/**
 * A route, under the prefix.
 *
 * `/` is the Square's front page, so it becomes `/square` — never `/square/`,
 * which is a second spelling of the same page and a duplicate for search. A
 * query or hash on the root keeps its place: `/?compose=1` → `/square?compose=1`,
 * the cross-product share contract.
 */
export function sq(path: string): string {
  if (isForeign(path) || isPrefixed(path)) return path;
  if (path === "/") return SQUARE_BASE;
  if (path.startsWith("/?") || path.startsWith("/#")) return `${SQUARE_BASE}${path.slice(1)}`;
  return `${SQUARE_BASE}${path}`;
}

/** A file in `public/`, served from `public/square/`. */
export function asset(path: string): string {
  if (isForeign(path) || isPrefixed(path)) return path;
  return `${SQUARE_BASE}${path}`;
}

/** A BFF endpoint of this app. `/api/…` only — anything else is not ours to prefix. */
export function api(path: string): string {
  if (isForeign(path) || isPrefixed(path)) return path;
  return `${SQUARE_BASE}${path}`;
}

/**
 * The route WITHOUT the prefix — for every comparison the app already makes.
 *
 * Twenty-two places decide what to show from the pathname (`=== "/messages"`,
 * `startsWith("/live/")`): the dock, compose, the welcome gate, back history.
 * After the move `usePathname()` answers `/square/messages`, and every one of
 * those would silently stop matching — no error, just a dock that never hides
 * and a compose button on the wrong screen. Normalising ONCE, where the
 * pathname is read, keeps all of that logic exactly as it was instead of
 * rewriting twenty-two comparisons and hoping none was missed.
 *
 * `/square` → `/`, `/square/feed` → `/feed`. A path outside the Square is
 * returned as it is, so it can never be mistaken for one of ours.
 */
export function stripSquare(pathname: string): string {
  if (pathname === SQUARE_BASE) return "/";
  if (pathname.startsWith(`${SQUARE_BASE}/`)) return pathname.slice(SQUARE_BASE.length);
  return pathname;
}
