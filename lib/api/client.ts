"use client";

import { DEMO_AUTH } from "@/lib/auth-mode";
import { currentAccessToken } from "@/lib/auth-token";
import { apiError } from "@/lib/api/envelope";
import {
  getAuthSnapshot,
  hasHeldSession,
  markSessionExpired,
  waitForAuthReady,
} from "@/lib/session";
import {
  circuitAllows,
  recordCircuitFailure,
  recordCircuitSuccess,
} from "@/lib/api/circuit-store";

// Fetch wrapper for our BFF routes. Attaches the Decane access token so the
// server can verify the caller and forward it upstream. In demo mode there is
// no session; the fixture BFF treats a tokenless request as the demo
// user, so requests go out bare.
//
// Two very different "no token" cases:
// - the session still hydrating: wait quietly for readiness, then retry the
//   token. Never surfaces to the user.
// - ready but the session is gone (expired): signal the SessionGuard
//   (which toasts once, clears cached identity and routes to /auth) and throw
//   a typed SESSION_EXPIRED so callers render a real message, not plumbing.
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts: {
    requireAuth?: boolean;
    /**
     * Does this request's health speak for Market Square?
     *
     * The breaker below is ONE breaker per tab, and its open state renders a
     * banner reading "Can't reach Market Square right now". That is correct for
     * `/api/market-square`, and wrong for every other upstream we proxy: the
     * KASH engine and the routing provider are separate services with separate
     * outages, and three 502s from a KASH balance poll must not tell forty
     * queries — the feed, messages, notifications — that the square is down.
     *
     * So a non-Market-Square client passes `breaker: false`. It still fails
     * honestly and its own surface goes quiet; it simply does not get a vote on
     * whether the rest of the app stops asking. Defaults true so the main
     * transport keeps exactly the behaviour it had.
     */
    breaker?: boolean;
  } = {}
): Promise<Response> {
  if (DEMO_AUTH) return fetch(path, init);

  let accessToken = currentAccessToken();
  if (opts.requireAuth && !accessToken) {
    // Give the session a chance to finish hydrating before judging it.
    await waitForAuthReady();
    accessToken = currentAccessToken();
    if (!accessToken) {
      const { ready, authenticated } = getAuthSnapshot();
      if (ready && !authenticated) {
        /*
          AN EXPIRY AND A GUEST LOOK IDENTICAL HERE, and they are not the same
          thing. Both read `{ ready: true, authenticated: false }`; only the
          session's history separates them.

          Treating every gated 401 as an expiry meant a signed-out visitor was
          told "Session expired — sign in again" — untrue, they never had one —
          and the guard then pushed them to /auth off whatever public page they
          were reading. Since the first gated poll fires within a second of
          load, that made the front door unreachable while signed out, which
          this app explicitly supports.

          A reader who never had a session gets `UNAUTHORIZED`, which already
          means "Sign in to continue": `isAuthError` still treats it as an auth
          failure so surfaces render their sign-in state, but nothing is
          announced and nothing navigates. Gated ACTIONS still route through
          `useGate`, which is where a sign-in prompt belongs.
        */
        if (hasHeldSession()) {
          markSessionExpired();
          throw apiError("SESSION_EXPIRED", "Session expired — sign in again.", 401);
        }
        throw apiError("UNAUTHORIZED", "Sign in to continue.", 401);
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
  const watched = opts.breaker !== false;
  const governed = watched && (method === "GET" || method === "HEAD");
  if (governed && !circuitAllows()) {
    throw apiError("SERVICE_DOWN", "Can't reach Square right now.", 503);
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch (error) {
    // Transport failure: no status, nothing to read. This is the clearest
    // signal the breaker gets, so it must not be swallowed.
    if (watched) recordCircuitFailure(undefined);
    throw error;
  }
  if (!watched) return response;
  if (response.ok) recordCircuitSuccess();
  else recordCircuitFailure(response.status);
  return response;
}
