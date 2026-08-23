// Without a Privy app id the app runs in demo mode: the client assumes a
// signed-in demo session and the BFF (in fixture mode) treats every request as
// the demo user. Set NEXT_PUBLIC_PRIVY_APP_ID to enable real login.
export const DEMO_AUTH = !process.env.NEXT_PUBLIC_PRIVY_APP_ID;
