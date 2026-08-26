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
function bodyInit(method: string, body: unknown): RequestInit {
  if (body === undefined) return { method };
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export interface ServiceClient {
  get<T>(path: string, params?: QueryParams): Promise<T>;
  authedGet<T>(path: string, params?: QueryParams): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string, body?: unknown): Promise<T>;
}

const FALLBACK = "Market Square is unreachable.";

function createServiceClient(basePath: string): ServiceClient {
  const url = (path: string, params?: QueryParams) => `${basePath}${path}${buildQuery(params)}`;

  const authed = <T>(path: string, init: RequestInit): Promise<T> =>
    apiFetch(path, init, { requireAuth: true }).then((res) => unwrap<T>(res, FALLBACK));

  return {
    // Public reads still attach a token when one exists (personalised lanes,
    // myTicket on stream detail) but never require one.
    get: <T>(path: string, params?: QueryParams) =>
      apiFetch(url(path, params)).then((res) => unwrap<T>(res, FALLBACK)),
    authedGet: <T>(path: string, params?: QueryParams) => authed<T>(url(path, params), {}),
    post: <T>(path: string, body?: unknown) => authed<T>(url(path), bodyInit("POST", body)),
    patch: <T>(path: string, body?: unknown) => authed<T>(url(path), bodyInit("PATCH", body)),
    put: <T>(path: string, body?: unknown) => authed<T>(url(path), bodyInit("PUT", body)),
    del: <T>(path: string, body?: unknown) => authed<T>(url(path), bodyInit("DELETE", body)),
  };
}

// The one transport. Every feature api client goes through this.
export const msApi = createServiceClient("/api/market-square");
