import { resolveAuthProvider } from "@/lib/auth-provider";

/**
 * The provider this build signs people in with, read from the environment once.
 *
 * The RULE lives in `lib/auth-provider.ts` and is pinned by `node --test`;
 * this file is only the wiring that hands it the environment. Splitting them
 * is what makes the decision checkable — a rule that reads `process.env`
 * directly can only be tested by mutating the process.
 */
export const AUTH_PROVIDER = resolveAuthProvider({
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
  decaneAppId: process.env.NEXT_PUBLIC_DECANE_APP_ID,
  decaneEnabled: process.env.NEXT_PUBLIC_MS_DECANE_AUTH_ENABLED === "true",
});

// Without a Privy app id the app runs in demo mode: the client assumes a
// signed-in demo session and the BFF (in fixture mode) treats every request as
// the demo user. Set NEXT_PUBLIC_PRIVY_APP_ID to enable real login.
//
// Unchanged in meaning — "no real provider is configured" — it is simply
// derived from the shared rule now, so demo mode and provider selection can
// never disagree about what is configured.
export const DEMO_AUTH = AUTH_PROVIDER === "demo";
