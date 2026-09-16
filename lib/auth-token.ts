"use client";

import { getAccessToken } from "@privy-io/react-auth";
import { AUTH_PROVIDER } from "@/lib/auth-mode";

/**
 * THE ONE PLACE THAT KNOWS WHO MINTS THE BEARER TOKEN.
 *
 * `lib/api/client.ts` and `lib/api/upload.ts` both used to import
 * `getAccessToken` from the vendor directly, so the transport — the single
 * chokepoint every feature's requests pass through — named the auth provider
 * twice. Adding a second provider would have meant editing the transport, and
 * a transport edited for an auth change is a transport that can break every
 * request in the app.
 *
 * Now they ask this. When Decane lands, the branch is added HERE and neither
 * call site changes.
 *
 * ─── WHY THERE IS NO PURE HALF TO TEST ───────────────────────────────────────
 * The decision this makes — which provider is active — is not made here; it is
 * `resolveAuthProvider` in `lib/auth-provider.ts`, which is pure and pinned by
 * `node --test`. What is left is a vendor call and a `catch`, and a module
 * importing `@privy-io/react-auth` cannot be loaded by the test runner at all.
 * So the rule is testable and the wiring is trivial, which is the split worth
 * having.
 *
 * NULL IS NOT AN ERROR. A missing token is an ordinary state — a signed-out
 * reader, a provider still warming up — and the caller decides what it means.
 * `lib/api/client.ts` draws the distinction that actually matters (expired
 * session vs. never signed in) and it needs a plain `null` to do it, not a
 * throw it would have to unwrap.
 */
export async function getAuthToken(): Promise<string | null> {
  // Demo mode mounts no provider, so there is nothing to ask. The fixture BFF
  // reads a tokenless request as the demo user.
  if (AUTH_PROVIDER === "demo") return null;

  // Only Privy mints today. The `decane` branch lands with the provider — see
  // the header; it belongs here and nowhere else.
  return getAccessToken().catch(() => null);
}
