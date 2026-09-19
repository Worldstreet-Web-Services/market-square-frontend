"use client";

import { apiFetch } from "@/lib/api/client";
import { applyRetryMarker, classifyLinkResponse, type LinkOutcome } from "@/lib/migration-link";
import { api } from "@/lib/square-path";

/**
 * Links the old Privy account to the signed-in Decane one.
 *
 * The CURRENT bearer goes where it always goes (apiFetch); the OLD identity's
 * tokens ride in their own headers and are handed in by the one page that holds
 * them, so they can never reach any other request. Nothing is thrown: every
 * answer the contract allows is a `LinkOutcome`, and a transport failure is
 * "try again later" — nothing was recorded.
 */
export async function linkLegacyAccount(legacy: {
  accessToken: string;
  idToken: string | null;
}): Promise<LinkOutcome> {
  const headers: Record<string, string> = {
    "x-legacy-authorization": `Bearer ${legacy.accessToken}`,
  };
  if (legacy.idToken) headers["privy-id-token"] = legacy.idToken;

  let outcome: LinkOutcome;
  try {
    const res = await apiFetch(
      api("/api/migration/link"),
      { method: "POST", headers, body: "{}" },
      // Not Market Square's health: a link outage must not trip the square's banner.
      { requireAuth: true, breaker: false }
    );
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    outcome = classifyLinkResponse(res.status, body?.error);
  } catch {
    outcome = { kind: "retry-later" };
  }
  applyRetryMarker(outcome);
  return outcome;
}
