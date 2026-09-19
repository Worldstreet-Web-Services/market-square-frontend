// Without a Decane app id the app runs in demo mode: the client assumes a
// signed-in demo session and the BFF (in fixture mode) treats every request as
// the demo user. Set NEXT_PUBLIC_DECANE_APP_ID to enable real login.
export const DEMO_AUTH = !process.env.NEXT_PUBLIC_DECANE_APP_ID;

// The Privy app the accounts lived on before the move to Decane. Only the
// "Bring your old account" sheet uses it, to sign into the OLD account once so
// it can be linked; nothing else in the app talks to Privy any more.
export const LEGACY_PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
