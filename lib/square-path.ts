/**
 * ONE APP, TWO ADDRESSES.
 *
 * The Square is its own site at `square.tsionark.com`, and that site does not
 * change. The same Square is ALSO shown inside Ark at `www.tsionark.com/square`,
 * as a Vercel microfrontend beside WSWS, which owns the rest of that domain.
 *
 * Those are two builds of this one repo, told apart by ONE build-time variable:
 *
 *   · `NEXT_PUBLIC_SQUARE_BASE_PATH` unset — the standalone site. No prefix;
 *     every helper here returns its input unchanged, so the app is exactly
 *     what it was before any of this existed.
 *   · `NEXT_PUBLIC_SQUARE_BASE_PATH=/square` — the build Ark mounts. Every
 *     address the app writes carries `/square`, and `next.config.ts` rewrites
 *     `/square/…` back onto the real routes, so the routes and files stay where
 *     they are in `app/` and `public/`.
 *
 * Why not Next's `basePath`: Vercel microfrontends do not support it (their
 * quickstart says so outright). A rewrite plus these helpers is the supported
 * shape, and keeping the prefix a variable is what leaves the standalone site
 * untouched.
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
 * and a path that already carries the prefix all come back unchanged.
 *
 * Pure and alias-free, so `node --test` pins it — both builds, through
 * `squarePaths(base)`.
 */

/** The only prefixes this app may be built with. Anything else is a config mistake. */
export function parseBase(raw: string | undefined): "" | "/square" {
  const value = raw?.trim() ?? "";
  if (value === "" ) return "";
  if (value === "/square") return "/square";
  throw new Error(`NEXT_PUBLIC_SQUARE_BASE_PATH must be unset or "/square", got "${value}"`);
}

export function squarePaths(base: "" | "/square") {
  /** Not a root path this app owns: an absolute URL, `//host`, `#hash`, `?query`, or empty. */
  const isForeign = (path: string) => !path.startsWith("/") || path.startsWith("//");

  /** Already under the prefix: `/square`, `/square/…`, `/square?…`, `/square#…`. */
  const isPrefixed = (path: string) =>
    base !== "" &&
    (path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}?`) || path.startsWith(`${base}#`));

  const prefix = (path: string) => (base === "" || isForeign(path) || isPrefixed(path) ? path : `${base}${path}`);

  return {
    base,
    /**
     * A route. `/` is the front page, so under the prefix it becomes `/square`
     * — never `/square/`, a second spelling of the same page. A query or hash
     * on the root keeps its place: `/?compose=1` → `/square?compose=1`, the
     * cross-product share contract.
     */
    sq(path: string): string {
      if (base === "" || isForeign(path) || isPrefixed(path)) return path;
      if (path === "/") return base;
      if (path.startsWith("/?") || path.startsWith("/#")) return `${base}${path.slice(1)}`;
      return `${base}${path}`;
    },
    /** A file in `public/`. */
    asset: prefix,
    /** A BFF endpoint of this app. */
    api: prefix,
    /**
     * The route WITHOUT the prefix — for every comparison the app makes.
     * Twenty-two places decide what to show from the pathname (`=== "/messages"`,
     * `startsWith("/live/")`); normalising where the pathname is read keeps all
     * of them working in both builds. A path outside the prefix comes back
     * unchanged, so the standalone build is a no-op.
     */
    stripSquare(pathname: string): string {
      if (base === "") return pathname;
      if (pathname === base) return "/";
      if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
      return pathname;
    },
  };
}

// `process.env.NEXT_PUBLIC_…` is inlined by Next at build time, so the client
// bundle carries the value it was built with. `process` is guarded for the
// test runner and any bundler that does not define it.
const paths = squarePaths(
  parseBase(typeof process === "undefined" ? undefined : process.env.NEXT_PUBLIC_SQUARE_BASE_PATH)
);

export const SQUARE_BASE = paths.base;
export const sq = paths.sq;
export const asset = paths.asset;
export const api = paths.api;
export const stripSquare = paths.stripSquare;
