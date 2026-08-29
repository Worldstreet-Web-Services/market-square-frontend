import "server-only";

import type { NextRequest } from "next/server";
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
