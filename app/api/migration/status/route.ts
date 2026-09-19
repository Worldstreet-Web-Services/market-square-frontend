import type { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/server/auth";
import { forwardMigration, migrationServiceEnabled, notConfigured, unauthorized } from "@/lib/server/migration";

export const maxDuration = 15;

/**
 * Where the move stands, for the signed-in DECANE account.
 *
 * Polled by /move-account while `rekey.square` is `pending`. It exists so the
 * page can poll something cheap: re-POSTing `/link` would work — it is
 * idempotent — but each call re-announces the mapping to every ledger, which
 * is a lot of event traffic to ask a spinner to generate.
 *
 * Only the current identity is needed, so there is no legacy header here. A
 * Privy bearer is refused for the same reason it is on `/link`: this must
 * answer for the account being moved ONTO.
 */
export async function GET(req: NextRequest) {
  if (!migrationServiceEnabled()) return notConfigured();
  const current = await verifyRequest(req);
  if (current?.provider !== "decane") return unauthorized();
  return forwardMigration("/status", {
    method: "GET",
    headers: { authorization: req.headers.get("authorization") ?? "" },
  });
}
