/**
 * THE PRIVY APP ID THE PROVIDER IS SAFE TO MOUNT WITH.
 *
 * `PrivyProvider` does not degrade on a bad id — it THROWS, "Cannot initialize
 * the Privy provider with an invalid Privy app ID", and because the provider
 * wraps the tree that throw happens while Next prerenders `/` and
 * `/_not-found`, which fails the whole build. A wrong value in one environment
 * variable takes the production build down.
 *
 * That is exactly what happened: CI set `NEXT_PUBLIC_PRIVY_APP_ID` to
 * `ci-placeholder`, a deliberate non-secret. The existing fallback only
 * covered an EMPTY value, so the malformed one sailed past it and every gates
 * run on every branch failed at the Build step — staging and its release
 * included (2026-09-21).
 *
 * So the rule is shape, not emptiness: anything that cannot be a Privy id is
 * treated as absent and replaced by a well-formed placeholder. The app then
 * builds and renders; signing in still needs the real id, which is the one
 * thing a placeholder can never fake and the one thing a build does not need.
 *
 * Pure, so `lib/privy-app-id.test.ts` pins it.
 */

/**
 * A well-formed id that belongs to nobody.
 *
 * Privy ids are lowercase alphanumeric and around 25 characters — this matches
 * that shape so the provider mounts, and matches no real app so it cannot
 * quietly authenticate against somebody else's.
 */
export const PLACEHOLDER_PRIVY_APP_ID = "cl0123456789abcdefghijklm";

/** Could this string be a Privy app id at all? */
export function looksLikePrivyAppId(value: string): boolean {
  return /^[a-z0-9]{20,32}$/.test(value);
}

/**
 * The id to hand the provider: the configured one when it could be real, the
 * placeholder when it could not.
 *
 * Never throws and never returns empty, because the caller is a provider that
 * cannot handle either.
 */
export function privyAppId(configured: string | undefined | null): string {
  const value = configured?.trim() ?? "";
  return looksLikePrivyAppId(value) ? value : PLACEHOLDER_PRIVY_APP_ID;
}
