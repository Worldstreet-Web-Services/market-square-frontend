import type { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/server/auth";
import {
  forwardMigration,
  migrationServiceEnabled,
  notConfigured,
  unauthorized,
  verifyLegacyAuthorization,
} from "@/lib/server/migration";

export const maxDuration = 30;

/**
 * Links the signed-in DECANE account to the Privy account whose token rides in
 * `x-legacy-authorization`. Both tokens are verified here before anything
 * leaves, and the service verifies them again and resolves the wallets on each
 * side itself — no address is ever sent, so a forged one cannot enter the
 * mapping.
 */
export async function POST(req: NextRequest) {
  if (!migrationServiceEnabled()) return notConfigured();
  const current = await verifyRequest(req);
  // The CURRENT side must be Decane. A legacy Privy session in the bearer slot
  // would pair the old account with itself.
  if (current?.provider !== "decane") return unauthorized();
  const legacy = await verifyLegacyAuthorization(req);
  if (!legacy) return unauthorized();

  const headers: Record<string, string> = {
    authorization: req.headers.get("authorization") ?? "",
    "x-legacy-authorization": `Bearer ${legacy.accessToken}`,
  };
  // Optional but worth sending: without it the service falls back to Privy's
  // management API to find the old wallets, which is slower and can fail.
  if (legacy.idToken) headers["privy-id-token"] = legacy.idToken;
  return forwardMigration("/link", { method: "POST", headers, body: "{}" });
}
