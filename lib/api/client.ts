"use client";

import { getAccessToken } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";

// Fetch wrapper for our BFF routes. Attaches the Privy access token so the
// server can verify the caller and forward it upstream. In demo mode there is
// no Privy session; the fixture BFF treats a tokenless request as the demo
// user, so requests go out bare.
//
// On a cold first load Privy can report "authenticated" a moment before the
// token is warm, so it can briefly be null. Callers of auth-gated routes pass
// `requireAuth` so that, instead of firing a request that 401s, we throw a
// retryable error and let the caller's query retry.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts: { requireAuth?: boolean } = {}
): Promise<Response> {
  if (DEMO_AUTH) return fetch(path, init);
  const accessToken = await getAccessToken().catch(() => null);
  if (opts.requireAuth && !accessToken) {
    throw new Error("Auth not ready, retrying");
  }
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(path, { ...init, headers });
}
