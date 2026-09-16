/**
 * WHICH PROVIDER THIS BUILD SIGNS PEOPLE IN WITH.
 *
 * Today the answer is always Privy, and this function exists so that stays
 * true until somebody deliberately changes it — not so it can be changed by
 * accident. The Privy -> Decane migration means a period where two providers
 * are configured at once, and the failure that period invites is a build that
 * silently picks the wrong one because half a configuration was present.
 *
 * ─── THE RULE THAT MATTERS: HALF-CONFIGURED IS NEVER ACTIVE ──────────────────
 * Decane needs BOTH an explicit opt-in flag AND an app id. Either alone falls
 * through to Privy. An app id pasted into an env file while the flag is off is
 * somebody preparing, not somebody switching; a flag turned on without an id
 * is a mistake, and honouring it would mount a provider that cannot mint a
 * token — signing everyone out of a working app to reach a broken one.
 *
 * ─── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 * It answers a question about CONFIGURATION, not about the reader. During the
 * dual-auth window an existing Privy session keeps working while new sign-ins
 * go to Decane, because every service accepts either token — but that is a
 * runtime fact about a session in hand, and nothing here can see it. Do not
 * reach for this to decide whether a particular reader is signed in.
 *
 * Pure, with no vendor imports and no `@/` alias, so `node --test` loads it
 * directly. That is the point: the one decision that can lock everybody out of
 * the app is the one decision that must be checkable without a browser.
 */

export type AuthProvider = "demo" | "privy" | "decane";

export interface AuthProviderEnv {
  /** `NEXT_PUBLIC_PRIVY_APP_ID`. Absent means no real login is configured. */
  privyAppId?: string | null;
  /** `NEXT_PUBLIC_DECANE_APP_ID` — public by Decane's own documentation. */
  decaneAppId?: string | null;
  /** `NEXT_PUBLIC_MS_DECANE_AUTH_ENABLED === "true"`. Defaults off, like every capability flag. */
  decaneEnabled?: boolean;
}

/**
 * Demo mode is the floor, not a state anybody opts into: with no provider
 * configured at all there is nothing to sign in with, and the fixture BFF
 * treats every caller as the demo user. That is exactly what `DEMO_AUTH` has
 * always meant, and this preserves it.
 */
export function resolveAuthProvider(env: AuthProviderEnv): AuthProvider {
  // Both halves, or it does not count. See the header.
  if (env.decaneEnabled === true && isPresent(env.decaneAppId)) return "decane";
  if (isPresent(env.privyAppId)) return "privy";
  return "demo";
}

/**
 * An empty string is not a configured id.
 *
 * `process.env.X` is `""` rather than `undefined` for a variable declared with
 * no value, which is the single most common way an env file half-configures
 * something — so a blank must read the same as absent or the guard above is
 * decorative.
 */
function isPresent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}
