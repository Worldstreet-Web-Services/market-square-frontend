"use client";

import { getAccessToken } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { apiError } from "@/lib/api/envelope";
import { getAuthSnapshot, markSessionExpired, waitForAuthReady } from "@/lib/session";
import {
  circuitAllows,
  recordCircuitFailure,
  recordCircuitSuccess,
} from "@/lib/api/circuit-store";

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

  /**
   * The breaker sits HERE, at the one transport every feature goes through,
   * rather than in each hook. While it is open nothing leaves the tab: no
   * network, and — because every path here is a BFF route — no serverless
   * invocation either. That second part is the one that cost money during the
   * outage; a request that never leaves is the only request that is free.
   *
   * Reads are what the breaker governs. A WRITE is the reader doing something
   * deliberate, and refusing it in-process would mean a post that silently
   * did not happen — those go out and fail honestly, and their failure still
   * informs the breaker.
   */
  const method = (init.method ?? "GET").toUpperCase();
  const governed = method === "GET" || method === "HEAD";
  if (governed && !circuitAllows()) {
    throw apiError("SERVICE_DOWN", "Can't reach Market Square right now.", 503);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch (error) {
    // Transport failure: no status, nothing to read. This is the clearest
    // signal the breaker gets, so it must not be swallowed.
    recordCircuitFailure(undefined);
    throw error;
  }
  if (response.ok) recordCircuitSuccess();
  else recordCircuitFailure(response.status);
  return response;
}
