"use client";

/**
 * Where the transport gets its bearer token.
 *
 * Decane's `getAccessToken()` is synchronous and lives on the kit's React
 * context, which a plain module like `apiFetch` cannot reach. So the provider
 * tree registers it here at mount (`DecaneTokenBridge`) and every request reads
 * it through `currentAccessToken()`.
 *
 * Only the CURRENT identity lives here. The old Privy token is used in exactly
 * one request — the account link — and the sheet that holds it passes it to
 * that call directly, so it can never leak into ordinary traffic and retarget
 * a request at the old account.
 */

type TokenSource = () => string | null;

let source: TokenSource | null = null;

export function registerDecaneTokenSource(next: TokenSource | null): void {
  source = next;
}

/** The Decane access token, or null when signed out, hydrating or not mounted. */
export function currentAccessToken(): string | null {
  try {
    return source ? source() : null;
  } catch {
    return null;
  }
}
