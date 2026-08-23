"use client";

import { getAccessToken } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { apiError } from "@/lib/api/envelope";
import { getAuthSnapshot, markSessionExpired, waitForAuthReady } from "@/lib/session";

// Fetch wrapper for our BFF routes. Attaches the Privy access token so the
// server can verify the caller and forward it upstream. In demo mode there is
// no Privy session; the fixture BFF treats a tokenless request as the demo
// user, so requests go out bare.
//
// Two very different "no token" cases:
// - Privy still initializing: wait quietly for readiness, then retry the
//   token. Never surfaces to the user.
// - Privy ready but the session is gone (expired): signal the SessionGuard
//   (which toasts once, clears cached identity and routes to /auth) and throw
//   a typed SESSION_EXPIRED so callers render a real message, not plumbing.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts: { requireAuth?: boolean } = {}
): Promise<Response> {
  if (DEMO_AUTH) return fetch(path, init);

  let accessToken = await getAccessToken().catch(() => null);
  if (opts.requireAuth && !accessToken) {
    // Give Privy a chance to finish warming up before judging the session.
    await waitForAuthReady();
    accessToken = await getAccessToken().catch(() => null);
    if (!accessToken) {
      const { ready, authenticated } = getAuthSnapshot();
      if (ready && !authenticated) {
        markSessionExpired();
        throw apiError("SESSION_EXPIRED", "Session expired — sign in again.", 401);
      }
      // Ready-but-no-token (cold refresh race) or still not ready after the
      // wait: retryable, and queries will retry it silently.
      throw apiError("AUTH_NOT_READY", "Still connecting — try again in a moment.", 401);
    }
  }
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(path, { ...init, headers });
}
