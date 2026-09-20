"use client";

import { apiFetch } from "@/lib/api/client";
import {
  applyRetryMarker,
  classifyLinkResponse,
  readSquareRekey,
  type LinkOutcome,
  type SquareRekey,
} from "@/lib/migration-link";
import { api } from "@/lib/square-path";

/**
 * What a link attempt produced: how it went, and — when Square answered —
 * where the profile move itself got to. The two are separate questions: the
 * pairing can be recorded (`linked`) while the move is still `pending`, or
 * even `failed`.
 */
export interface LinkResult {
  outcome: LinkOutcome;
  square: SquareRekey;
}

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
}): Promise<LinkResult> {
  const headers: Record<string, string> = {
    "x-legacy-authorization": `Bearer ${legacy.accessToken}`,
  };
  if (legacy.idToken) headers["privy-id-token"] = legacy.idToken;

  let outcome: LinkOutcome;
  let square: SquareRekey = "unknown";
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
    square = readSquareRekey(body);
  } catch {
    outcome = { kind: "retry-later" };
  }
  applyRetryMarker(outcome);
  return { outcome, square };
}

/**
 * Where the move stands now. Used only to wait out a `pending` — the link
 * already reported once, and this asks the same question again without
 * re-announcing the mapping to every ledger.
 *
 * Never throws: a failed poll reads as `unknown`, which ends the wait rather
 * than spinning forever on a service that is not answering.
 */
export async function fetchSquareRekey(): Promise<SquareRekey> {
  try {
    const res = await apiFetch(
      api("/api/migration/status"),
      { method: "GET" },
      { requireAuth: true, breaker: false }
    );
    if (!res.ok) return "unknown";
    return readSquareRekey(await res.json().catch(() => null));
  } catch {
    return "unknown";
  }
}

/**
 * Has this account already been joined to an old one?
 *
 * `true` means the move is done and there is nothing to offer; `false` means
 * it has not happened, which is when the offer is worth making. `null` means
 * we could not tell — linking is off in this deployment, the reader has no
 * session yet, or the service did not answer.
 *
 * Callers treat `null` as "offer anyway": offering the move to somebody who
 * does not need it costs them a tap, and withholding it from somebody who does
 * costs them their account.
 */
export async function fetchMigrationLinked(): Promise<boolean | null> {
  try {
    const res = await apiFetch(
      api("/api/migration/status"),
      { method: "GET" },
      { requireAuth: true, breaker: false }
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { data?: { linked?: unknown } } | null;
    return typeof body?.data?.linked === "boolean" ? body.data.linked : null;
  } catch {
    return null;
  }
}
