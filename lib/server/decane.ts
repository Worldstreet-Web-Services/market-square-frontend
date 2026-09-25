import "server-only";

import { DecaneClient } from "decane-node";

let client: DecaneClient | null = null;

/**
 * Can this environment verify a Decane session at all?
 *
 * Only the app id is needed: decane-node verifies against Decane's published
 * JWKS, or offline against `DECANE_VERIFICATION_KEY` when that is set (it reads
 * the variable itself). There is no app secret to hold, unlike Privy.
 */
export function decaneConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_DECANE_APP_ID);
}

export function getDecaneClient(): DecaneClient {
  if (client) return client;
  const appId = process.env.NEXT_PUBLIC_DECANE_APP_ID;
  if (!appId) throw new Error("Decane is not configured. Set NEXT_PUBLIC_DECANE_APP_ID.");
  client = new DecaneClient({ appId });
  return client;
}
