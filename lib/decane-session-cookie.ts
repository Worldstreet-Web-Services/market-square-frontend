"use client";

import { api } from "@/lib/square-path";

/**
 * Mirrors the Decane access token into a cookie, for requests that cannot carry
 * a Bearer header.
 *
 * Privy set a `privy-token` cookie of its own, and one route came to rely on it
 * without anyone deciding so: the chain-pinned receipt reader
 * (`lib/trade/receipt.ts`) talks to `/api/evm-rpc` through viem's transport,
 * which attaches no Authorization header. Decane keeps its token in memory and
 * sets no cookie, so without this that read is refused and silently falls back
 * to a public node.
 *
 * Deliberately narrow, because a bearer in a non-HttpOnly cookie is readable by
 * any script on the origin: scoped to this app's `/api` (so under the Ark zone
 * it is `/square/api` and never reaches wsws's routes), SameSite=Lax, Secure on
 * https, and it expires with the token.
 */

const COOKIE = "decane-token";
const FALLBACK_MAX_AGE_S = 3600;

function expiresAt(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function write(value: string, maxAgeSeconds: number): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${value}; Path=${api("/api")}; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function syncDecaneSessionCookie(token: string | null): void {
  if (typeof document === "undefined") return;
  if (!token) return write("", 0);
  const exp = expiresAt(token);
  const remaining = exp ? exp - Math.floor(Date.now() / 1000) : FALLBACK_MAX_AGE_S;
  if (remaining <= 0) return write("", 0);
  write(token, remaining);
}

export function clearDecaneSessionCookie(): void {
  syncDecaneSessionCookie(null);
}
