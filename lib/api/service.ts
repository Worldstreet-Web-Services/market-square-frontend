"use client";

import { apiFetch } from "@/lib/api/client";
import { unwrap } from "@/lib/api/envelope";

export type QueryParams = Record<string, string | number | boolean | undefined>;

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

// Strict servers reject a JSON content-type with an empty body.
function bodyInit(
  method: string,
  body: unknown,
  headers: Record<string, string> = {}
): RequestInit {
  if (body === undefined) return { method, headers };
  return {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

export interface ServiceClient {
  get<T>(path: string, params?: QueryParams): Promise<T>;
  authedGet<T>(path: string, params?: QueryParams): Promise<T>;
  /**
   * `headers` exists for ONE thing: an `Idempotency-Key` on a request that
   * moves money. It is a per-call value minted where the user's intent begins,
   * so it cannot live on the client, and it must survive a retry unchanged —
   * which is the whole reason the caller supplies it rather than the transport
   * generating one.
   */
  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string, body?: unknown): Promise<T>;
}

const FALLBACK = "Square is unreachable.";

export interface ServiceClientOptions {
  /** Copy for a failure with no message of its own. Names the service that failed. */
  fallbackMessage?: string;
  /**
   * Whether this client's failures speak for Market Square as a whole.
   *
   * True only for the Market Square BFF itself. A separate upstream — the KASH
   * engine, the routing provider — has its own outages, and letting one of them
   * open the shared breaker would take the feed down over a balance poll. See
   * `apiFetch`.
   */
  breaker?: boolean;
}

/**
 * A client for one BFF prefix.
 *
 * Exported because Market Square now proxies more than one upstream. Each gets
 * its own client rather than sharing `msApi`, so its base path, its failure
 * copy and its breaker participation are stated once, at the boundary, instead
 * of being threaded through every call.
 */
export function createServiceClient(
  basePath: string,
  options: ServiceClientOptions = {}
): ServiceClient {
  const fallback = options.fallbackMessage ?? FALLBACK;
  const breaker = options.breaker ?? true;
  const url = (path: string, params?: QueryParams) => `${basePath}${path}${buildQuery(params)}`;

  const authed = <T>(path: string, init: RequestInit): Promise<T> =>
    apiFetch(path, init, { requireAuth: true, breaker }).then((res) => unwrap<T>(res, fallback));

  return {
    // Public reads still attach a token when one exists (personalised lanes,
    // myTicket on stream detail) but never require one.
    get: <T>(path: string, params?: QueryParams) =>
      apiFetch(url(path, params), {}, { breaker }).then((res) => unwrap<T>(res, fallback)),
    authedGet: <T>(path: string, params?: QueryParams) => authed<T>(url(path, params), {}),
    post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      authed<T>(url(path), bodyInit("POST", body, headers)),
    patch: <T>(path: string, body?: unknown) => authed<T>(url(path), bodyInit("PATCH", body)),
    put: <T>(path: string, body?: unknown) => authed<T>(url(path), bodyInit("PUT", body)),
    del: <T>(path: string, body?: unknown) => authed<T>(url(path), bodyInit("DELETE", body)),
  };
}

// The one Market Square transport. Every feature api client for the square
// itself goes through this.
export const msApi = createServiceClient("/api/market-square");
