import "server-only";

import type { NextRequest } from "next/server";
import type { User } from "@privy-io/node";
import { getPrivyClient, privyConfigured } from "@/lib/server/privy";

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

/**
 * Why a request has no verified caller — and the reason this is not a boolean.
 *
 * These three used to be one `null`, and in production that cost us a day:
 * a browser with a perfectly good Privy session got 401 "Sign in to continue."
 * on every authenticated call, because the SERVER could not verify tokens at
 * all. `verifyAccessToken` throws when `PRIVY_APP_SECRET` is missing, or is
 * for a different app than the one the browser signed into — and that throw
 * was caught and returned as "no valid session", which is indistinguishable
 * from a signed-out visitor and produces exactly the same 401.
 *
 * So the app told the user they were signed out while they were looking at
 * their own avatar. A misconfigured server must never be able to impersonate a
 * signed-out user; it is a 503 with our name on it, not a 401 with theirs.
 */
export type AuthFailure =
  /** No Authorization header and no cookie. A signed-out visitor. */
  | "no-token"
  /** A token was presented and Privy rejected it. Expired, or another app's. */
  | "invalid-token"
  /** We cannot verify anything — our configuration, not their session. */
  | "unavailable";

export type AuthResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: AuthFailure };

function extractAccessToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return req.cookies.get("privy-token")?.value ?? null;
}

/** Verification, with the reason kept. */
export async function verifyRequestDetailed(req: NextRequest): Promise<AuthResult> {
  const token = extractAccessToken(req);
  if (!token) return { ok: false, reason: "no-token" };

  if (!privyConfigured()) {
    // Logged, because nothing else in the system will say this out loud and
    // the symptom (everyone appears signed out) points at the wrong half.
    console.error(
      "[ms-auth] cannot verify sessions: PRIVY_APP_SECRET / NEXT_PUBLIC_PRIVY_APP_ID are not both set in this environment"
    );
    return { ok: false, reason: "unavailable" };
  }

  try {
    const claims = await getPrivyClient().utils().auth().verifyAccessToken(token);
    return { ok: true, claims: { userId: claims.user_id, sessionId: claims.session_id } };
  } catch (error) {
    // A rejected token is ordinary and stays quiet; anything else is ours.
    const label = error instanceof Error ? error.message : String(error);
    if (/token|jwt|expired|signature|audience|issuer/i.test(label)) {
      return { ok: false, reason: "invalid-token" };
    }
    console.error("[ms-auth] session verification failed for a non-token reason:", label);
    return { ok: false, reason: "unavailable" };
  }
}

// Verifies the caller's Privy access token. Returns null when the request
// carries no token or the token fails verification.
export async function verifyRequest(req: NextRequest): Promise<AccessClaims | null> {
  const result = await verifyRequestDetailed(req);
  return result.ok ? result.claims : null;
}

/**
 * The FULL Privy user behind a verified session — the linked accounts, and so
 * the wallet the session actually owns.
 *
 * `verifyRequest` proves *who* is calling; this is what proves *what they own*,
 * and the KASH proxy needs both. An access token carries a user id and nothing
 * about wallets, so a route that must refuse "read someone else's balance" has
 * to go and ask Privy which wallet belongs to this user. Trusting a wallet the
 * BROWSER named would make the whole gate decorative.
 *
 * Two sources, in order. The identity token, when the client sent one, is a
 * signed snapshot of the user and needs no round trip to Privy's API. Without
 * it — or when it is stale, which happens right after a wallet is created — we
 * fall back to fetching the verified user id. The fallback is what keeps a
 * money-moving route working on a cold page load rather than telling a signed-in
 * reader they own no wallet.
 */
const REQUEST_USER_CACHE_TTL_MS = 60_000;
const REQUEST_USER_CACHE_MAX_ENTRIES = 1_000;

interface CachedRequestUser {
  user: User;
  expiresAt: number;
}

/**
 * A tiny per-instance cache, keyed on the SESSION rather than the user.
 *
 * Every wallet-scoped KASH call resolves the caller's wallet, and the balance
 * poll alone is one call every few seconds per open tab. Without this, each of
 * them is a round trip to Privy on the hot path of a serverless invocation we
 * are billed for. Sixty seconds is well inside the window in which a user's
 * linked wallets can change, and the key includes the session id so signing out
 * and back in never reads a stale answer.
 *
 * Bounded and LRU-ish: entries are re-inserted on read so the eviction below
 * drops the least recently used rather than the oldest created.
 */
const requestUserCache = new Map<string, CachedRequestUser>();
/** In-flight loads, so a burst of concurrent polls makes ONE upstream call. */
const requestUserLoads = new Map<string, Promise<User | null>>();

function cachedRequestUser(key: string): User | null {
  const cached = requestUserCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    requestUserCache.delete(key);
    return null;
  }
  requestUserCache.delete(key);
  requestUserCache.set(key, cached);
  return cached.user;
}

function cacheRequestUser(key: string, user: User): void {
  if (requestUserCache.size >= REQUEST_USER_CACHE_MAX_ENTRIES) {
    const oldest = requestUserCache.keys().next().value;
    if (oldest) requestUserCache.delete(oldest);
  }
  requestUserCache.set(key, { user, expiresAt: Date.now() + REQUEST_USER_CACHE_TTL_MS });
}

export async function getRequestUser(
  req: NextRequest,
  claims: AccessClaims | null = null
): Promise<User | null> {
  if (!privyConfigured()) return null;

  const idToken =
    req.headers.get("privy-id-token") ?? req.cookies.get("privy-id-token")?.value ?? null;

  const load = async (): Promise<User | null> => {
    if (idToken) {
      try {
        return await getPrivyClient().users().get({ id_token: idToken });
      } catch {
        // Stale or malformed. Fall through to the verified user id rather than
        // failing: the id token is an optimisation, not the proof.
      }
    }
    if (!claims) return null;
    try {
      return await getPrivyClient().users()._get(claims.userId);
    } catch (error) {
      // Worth saying out loud: every wallet-scoped route 403s from here, and
      // nothing else in the system explains why.
      console.error(
        "[ms-auth] could not resolve the Privy user for a verified session:",
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  };

  // Without claims there is no stable key to cache or coalesce under.
  if (!claims) return load();

  const key = `${claims.userId}:${claims.sessionId}`;
  const cached = cachedRequestUser(key);
  if (cached) return cached;

  const pending = requestUserLoads.get(key);
  if (pending) return pending;

  const request = load()
    .then((user) => {
      if (user) cacheRequestUser(key, user);
      return user;
    })
    .finally(() => requestUserLoads.delete(key));
  requestUserLoads.set(key, request);
  return request;
}
