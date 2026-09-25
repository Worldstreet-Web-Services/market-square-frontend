import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { verifyPrivyAccessToken } from "@/lib/server/auth";

/**
 * The platform's account-link service: user-management, `/v1/user-management`
 * on the gateway (the migration contract is mounted at that service's root).
 *
 * Off unless `MIGRATION_SERVICE_ENABLED=1`, and that flag is a promise about
 * the ENVIRONMENT: the gateway `WSAPI_BASE_URL` points at must actually carry a
 * `migration` entry (staging does; production does not yet). Pointing the base
 * at one environment while the service lives in another would pair production
 * identities against staging data. `MIGRATION_API_URL` overrides the base for
 * a local service only.
 */
export function migrationServiceEnabled(): boolean {
  return process.env.MIGRATION_SERVICE_ENABLED === "1";
}

function base(): string | null {
  if (process.env.MIGRATION_API_URL) return process.env.MIGRATION_API_URL.replace(/\/+$/u, "");
  const gateway = process.env.WSAPI_BASE_URL?.replace(/\/+$/u, "");
  return gateway ? `${gateway}/v1/user-management` : null;
}

/** The OLD Privy identity's credentials, riding beside the Decane bearer. */
export interface LegacyAuthorization {
  accessToken: string;
  idToken: string | null;
}

/**
 * Verifies `x-legacy-authorization` as a PRIVY token specifically — a Decane
 * token in that slot would link an account to itself or to a stranger.
 */
export async function verifyLegacyAuthorization(req: NextRequest): Promise<LegacyAuthorization | null> {
  const header = req.headers.get("x-legacy-authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const accessToken = header.slice("Bearer ".length);
  if (!(await verifyPrivyAccessToken(accessToken))) return null;
  return { accessToken, idToken: req.headers.get("privy-id-token") };
}

function envelope(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export const notConfigured = () => envelope(503, "NOT_CONFIGURED", "Account linking is not available here.");
export const unauthorized = () => envelope(401, "UNAUTHORIZED", "Sign in to continue.");

/**
 * Forwards with the upstream body and status untouched — the client reads the
 * service's own codes and messages (see `lib/migration-link.ts`), so nothing
 * here may rewrite them. An unreachable service is a 502 in the same envelope.
 */
export async function forwardMigration(
  path: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string }
): Promise<NextResponse> {
  const root = base();
  if (!root) return notConfigured();
  const headers: Record<string, string> = { accept: "application/json", ...init.headers };
  if (init.method !== "GET") headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${root}${path}`, {
      method: init.method,
      headers,
      body: init.body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("[ms-migration] link service unreachable:", path, error instanceof Error ? error.message : error);
    return envelope(502, "UPSTREAM_ERROR", "The account link service is unreachable.");
  }
}
