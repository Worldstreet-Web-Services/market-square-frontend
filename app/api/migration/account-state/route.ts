import type { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/server/auth";
import { forwardMigration, migrationServiceEnabled, notConfigured, unauthorized } from "@/lib/server/migration";

export const maxDuration = 30;

/**
 * Where a fresh Decane sign-in stands: `linked`, `legacy` (an old account is
 * waiting, run the upgrade before anything else), `new`, or `unknown`.
 *
 * Asked by the migration gate BEFORE the app's first Square call, because
 * that first call is what provisions an empty profile under the new id, and
 * an empty profile that gets touched refuses the re-key for good.
 *
 * The email is the client's own word, from the Decane sign-in profile. The
 * service treats it as a hint that shapes a flow, never as authority — the
 * link still needs both provider tokens — so nothing here need verify it
 * beyond shape. Bounded, so nothing absurd reaches a lookup.
 */
export async function POST(req: NextRequest) {
  if (!migrationServiceEnabled()) return notConfigured();
  const current = await verifyRequest(req);
  if (current?.provider !== "decane") return unauthorized();

  let email: string | null = null;
  try {
    const body = (await req.json()) as { email?: unknown };
    if (typeof body.email === "string") email = body.email.trim().toLowerCase();
  } catch {
    // No body, or not JSON: the service answers "unknown" for no email.
  }
  if (email && (email.length > 320 || !email.includes("@"))) email = null;

  return forwardMigration("/legacy-account", {
    method: "POST",
    headers: { authorization: req.headers.get("authorization") ?? "" },
    body: JSON.stringify({ email }),
  });
}
