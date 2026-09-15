/**
 * ONE ANONYMOUS READ FOR A SHARE PREVIEW, and an honest answer about how it went.
 *
 * A link preview is fetched by a crawler we do not control, on a page anyone
 * can request, so this read is deliberately narrow:
 *
 *  · ANONYMOUS. No Authorization, no cookie — a preview must never say more
 *    than a signed-out visitor could read.
 *  · BOUNDED. A crawler waits a few seconds at most; past that the page ships
 *    with generic tags rather than holding the response open.
 *  · THREE OUTCOMES, NOT TWO. `not-found` means the SERVICE said the post or
 *    profile does not exist — the one answer that lets the page 404, which is
 *    what makes a crawler drop a cached card. Everything else that is not a
 *    clean success is `unavailable`, answered with generic metadata.
 *
 * NOT EVERY 404 IS "GONE". The gateway answers a misrouted path, and an
 * unknown service, with the same status and the same `NOT_FOUND` code as a
 * missing post (checked against production): only the message differs. A bad
 * `WSAPI_BASE_URL` read as "gone" would 404 every post and profile to every
 * chat app at once, and they cache that. So `not-found` requires the service's
 * own "Post not found" / "Profile not found"; any other 404 is `unavailable`.
 * Matching a sentence is a stopgap — a distinct error code has been asked of
 * the backend, and this should switch to it the day it exists.
 *
 * NOTHING IS CACHED ACROSS REQUESTS — `cache: "no-store"`, deliberately. This
 * read used to ask for a minute of `next.revalidate`, and an explicit
 * revalidate beats `dynamic = "force-dynamic"`, so the cache was real. Next's
 * fetch cache is stale-while-revalidate: a stale entry is SERVED while the
 * refetch runs in the background, and only a 200 is ever written back
 * (`server/lib/patch-fetch.js`). So once a post had been previewed, removing
 * it changed nothing: every later scrape got the stale 200 — its words and its
 * photo — and the background 404 was never stored to replace it. For a
 * preview, being current is the whole point; crawler traffic is small, and
 * React `cache()` in `og-data.ts` still makes it one read per request.
 *
 * Dependency-free and alias-free, like `proxy.ts`, so it is tested against a
 * stub fetch.
 */

export type OgFetchResult =
  | { status: "ok"; data: unknown }
  | { status: "not-found" }
  | { status: "unavailable" };

export const OG_FETCH_TIMEOUT_MS = 2_500;

/** The service's own "this does not exist" messages — see the header. */
const GONE_MESSAGES = new Set(["Post not found", "Profile not found"]);

type OgFetchInit = RequestInit;

export interface OgFetchOptions {
  fetchImpl?: (url: string, init: OgFetchInit) => Promise<Response>;
  timeoutMs?: number;
}

export async function fetchOgJson(url: string, options: OgFetchOptions = {}): Promise<OgFetchResult> {
  const doFetch = options.fetchImpl ?? (fetch as NonNullable<OgFetchOptions["fetchImpl"]>);
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? OG_FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { status: "unavailable" };
  }
  if (res.status === 404) return (await isGone(res)) ? { status: "not-found" } : { status: "unavailable" };
  if (res.status !== 200) return { status: "unavailable" };
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    return { status: "unavailable" };
  }
  const envelope = body as { success?: unknown; data?: unknown } | null;
  if (!envelope || envelope.success !== true || typeof envelope.data !== "object" || envelope.data === null) {
    return { status: "unavailable" };
  }
  return { status: "ok", data: envelope.data };
}

/** Did the service itself say this post or profile does not exist? */
async function isGone(res: Response): Promise<boolean> {
  try {
    const body = JSON.parse(await res.text()) as { error?: { message?: unknown } } | null;
    const message = body?.error?.message;
    return typeof message === "string" && GONE_MESSAGES.has(message);
  } catch {
    return false;
  }
}
