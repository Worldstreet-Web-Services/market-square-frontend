import "server-only";

import type { NextRequest } from "next/server";
import type { User } from "@privy-io/node";
import { DecaneAuthError } from "decane-node";
import { decaneConfigured, getDecaneClient } from "@/lib/server/decane";
import { getPrivyClient, privyConfigured } from "@/lib/server/privy";
import { embeddedEvmWallet } from "@/lib/wallet";

export interface AccessClaims {
  /**
   * Which issuer verified this token. Branch on this, never on the id's shape:
   * a Privy DID and a Decane UUID look nothing alike, and guessing from the
   * string is exactly the kind of check that rots.
   */
  provider: "decane" | "privy";
  userId: string;
  sessionId: string;
}

/**
 * Why a request has no verified caller — and the reason this is not a boolean.
 *
 * These three used to be one `null`, and in production that cost us a day:
 * a browser with a perfectly good session got 401 "Sign in to continue." on
 * every authenticated call, because the SERVER could not verify tokens at all
 * (a missing `PRIVY_APP_SECRET`, then). That throw was caught and returned as
 * "no valid session", indistinguishable from a signed-out visitor.
 *
 * So the app told the user they were signed out while they were looking at
 * their own avatar. A misconfigured server must never be able to impersonate a
 * signed-out user; it is a 503 with our name on it, not a 401 with theirs.
 */
export type AuthFailure =
  /** No Authorization header and no cookie. A signed-out visitor. */
  | "no-token"
  /** A token was presented and every configured issuer rejected it. */
  | "invalid-token"
  /** We cannot verify anything — our configuration or our reachability, not their session. */
  | "unavailable";

export type AuthResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: AuthFailure };

/**
 * The bearer, then the cookies. `decane-token` is written by
 * `DecaneTokenBridge` for transports that cannot send a header (the receipt
 * reader's `/api/evm-rpc` calls); `privy-token` is what a browser still on a
 * pre-migration Privy session carries until it ages out.
 */
function extractAccessToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return req.cookies.get("decane-token")?.value ?? req.cookies.get("privy-token")?.value ?? null;
}

type IssuerVerdict = { ok: true; claims: AccessClaims } | { ok: false; unavailable: boolean };

/**
 * jose's own codes for "this token is not acceptable". Anything else under a
 * DecaneAuthError — a JWKS fetch that timed out, a network failure reaching
 * the key set — is us failing to check, not the token failing the check.
 * `ERR_JWKS_NO_MATCHING_KEY` is the token's fault: it is what a Privy token
 * gets, signed by a key Decane never published.
 */
const TOKEN_FAULT_CODE = /^ERR_(JWT|JWS|JWK_|JWKS_NO_MATCHING_KEY|JOSE_ALG|JOSE_NOT_SUPPORTED)/u;

async function verifyWithDecane(token: string): Promise<IssuerVerdict> {
  try {
    const claims = await getDecaneClient().verifyAccessToken(token);
    return {
      ok: true,
      claims: {
        provider: "decane",
        userId: claims.userId,
        // Decane has no session id. The token id is unique per issued token,
        // and this only keys the short-lived wallet cache below.
        sessionId: claims.tokenId ?? `${claims.userId}:${claims.issuedAt ?? 0}`,
      },
    };
  } catch (error) {
    if (error instanceof DecaneAuthError) {
      const cause = error.cause as { code?: unknown } | undefined;
      const code = typeof cause?.code === "string" ? cause.code : "";
      // No cause means a claim check (project mismatch, missing uid): the token's fault.
      const tokenFault = !error.cause || TOKEN_FAULT_CODE.test(code);
      if (!tokenFault) {
        console.error("[ms-auth] could not reach Decane's key set:", code || String(error.cause));
      }
      return { ok: false, unavailable: !tokenFault };
    }
    console.error("[ms-auth] Decane verification failed for a non-token reason:", String(error));
    return { ok: false, unavailable: true };
  }
}

async function verifyWithPrivy(token: string): Promise<IssuerVerdict> {
  try {
    const claims = await getPrivyClient().utils().auth().verifyAccessToken(token);
    return {
      ok: true,
      claims: { provider: "privy", userId: claims.user_id, sessionId: claims.session_id },
    };
  } catch (error) {
    // A rejected token is ordinary and stays quiet; anything else is ours.
    const label = error instanceof Error ? error.message : String(error);
    if (/token|jwt|expired|signature|audience|issuer|jws|compact/i.test(label)) {
      return { ok: false, unavailable: false };
    }
    console.error("[ms-auth] Privy verification failed for a non-token reason:", label);
    return { ok: false, unavailable: true };
  }
}

/**
 * Verifies a Privy access token on its own. Used by the account-link route,
 * which carries the OLD identity's token in a second header and must never
 * accept a Decane token in that slot.
 */
export async function verifyPrivyAccessToken(token: string): Promise<AccessClaims | null> {
  if (!privyConfigured()) return null;
  const verdict = await verifyWithPrivy(token);
  return verdict.ok ? verdict.claims : null;
}

/**
 * Verification, with the reason kept.
 *
 * TWO ISSUERS during the move from Privy to Decane: Decane first, since it is
 * who the app signs people in with now, then Privy, so a browser still holding
 * a pre-migration session keeps working until that session expires instead of
 * everybody being signed out on deploy. The Privy leg goes away with
 * `PRIVY_APP_SECRET` once those sessions have aged out.
 */
export async function verifyRequestDetailed(req: NextRequest): Promise<AuthResult> {
  const token = extractAccessToken(req);
  if (!token) return { ok: false, reason: "no-token" };

  const issuers = [
    decaneConfigured() ? verifyWithDecane : null,
    privyConfigured() ? verifyWithPrivy : null,
  ].filter((issuer): issuer is (token: string) => Promise<IssuerVerdict> => issuer !== null);

  if (issuers.length === 0) {
    // Logged, because nothing else in the system will say this out loud and
    // the symptom (everyone appears signed out) points at the wrong half.
    console.error(
      "[ms-auth] cannot verify sessions: neither NEXT_PUBLIC_DECANE_APP_ID nor the Privy pair is set in this environment"
    );
    return { ok: false, reason: "unavailable" };
  }

  let unavailable = false;
  for (const issuer of issuers) {
    const verdict = await issuer(token);
    if (verdict.ok) return verdict;
    unavailable ||= verdict.unavailable;
  }
  return { ok: false, reason: unavailable ? "unavailable" : "invalid-token" };
}

// Returns null when the request carries no token or no issuer verifies it.
export async function verifyRequest(req: NextRequest): Promise<AccessClaims | null> {
  const result = await verifyRequestDetailed(req);
  return result.ok ? result.claims : null;
}

/**
 * The EVM wallet a verified session OWNS, proven server-side.
 *
 * `verifyRequest` proves *who* is calling; this proves *what they own*, and the
 * KASH proxy needs both. An access token names a user and nothing about
 * wallets, so a route that must refuse "read someone else's balance" has to ask
 * the issuer. Trusting a wallet the BROWSER named would make the gate
 * decorative.
 *
 *   · Decane — the session's one embedded EVM wallet, from Decane's address
 *     endpoint with the caller's own token.
 *   · Privy — the embedded wallet among the user's linked accounts
 *     (`embeddedEvmWallet`, the rule `lib/wallet.test.ts` pins).
 */
export async function getRequestWallet(
  req: NextRequest,
  claims: AccessClaims | null
): Promise<string | null> {
  if (!claims) return null;
  const key = `${claims.provider}:${claims.userId}:${claims.sessionId}`;
  const cached = cachedWallet(key);
  if (cached !== undefined) return cached;

  const pending = walletLoads.get(key);
  if (pending) return pending;

  const load = async (): Promise<string | null> => {
    if (claims.provider === "decane") {
      const token = extractAccessToken(req);
      if (!token) return null;
      try {
        return (await getDecaneClient().getAddresses(token)).evm;
      } catch (error) {
        console.error(
          "[ms-auth] could not resolve the Decane wallet for a verified session:",
          error instanceof Error ? error.message : String(error)
        );
        return null;
      }
    }
    return embeddedEvmWallet((await getRequestUser(req, claims))?.linked_accounts);
  };

  const request = load()
    .then((wallet) => {
      // Only a found wallet is cached: a transient miss must not lock a
      // reader out of their own balance for a minute.
      if (wallet) cacheWallet(key, wallet);
      return wallet;
    })
    .finally(() => walletLoads.delete(key));
  walletLoads.set(key, request);
  return request;
}

const walletCache = new Map<string, { wallet: string; expiresAt: number }>();
const walletLoads = new Map<string, Promise<string | null>>();

function cachedWallet(key: string): string | undefined {
  const entry = walletCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    walletCache.delete(key);
    return undefined;
  }
  walletCache.delete(key);
  walletCache.set(key, entry);
  return entry.wallet;
}

function cacheWallet(key: string, wallet: string): void {
  if (walletCache.size >= REQUEST_USER_CACHE_MAX_ENTRIES) {
    const oldest = walletCache.keys().next().value;
    if (oldest) walletCache.delete(oldest);
  }
  walletCache.set(key, { wallet, expiresAt: Date.now() + REQUEST_USER_CACHE_TTL_MS });
}

/**
 * The FULL Privy user behind a verified PRIVY session — the linked accounts, and so
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
  // Legacy sessions only. A Decane session has no Privy user to load, and an
  // identity token beside one must not be read as that caller's wallet.
  if (!privyConfigured() || claims?.provider === "decane") return null;

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
