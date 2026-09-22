"use client";

import { apiFetch } from "@/lib/api/client";
import { errorCode } from "@/lib/api/envelope";
import {
  applyRetryMarker,
  classifyLinkResponse,
  readSquareRekey,
  type LinkOutcome,
  type SquareRekey,
} from "@/lib/migration-link";
import { api } from "@/lib/square-path";
import type { AccountState } from "@/lib/account-state";

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
  } catch (error) {
    /*
      apiFetch THROWS before anything leaves when the bearer is missing or
      dead, so these never reached the service and are not outages. Telling
      somebody whose session expired to "come back later" sends them away to
      retry a thing that will fail identically, and sets a marker advertising
      it.
    */
    const code = errorCode(error);
    outcome =
      code === "SESSION_EXPIRED" || code === "UNAUTHORIZED" || code === "ACCOUNT_UPGRADED"
        ? { kind: "reauth" }
        : { kind: "retry-later" };
  }
  applyRetryMarker(outcome);
  return { outcome, square };
}

/**
 * Where the move stands now. Used only to wait out a `pending` — the link
 * already reported once, and this asks the same question again without
 * re-announcing the mapping to every ledger.
 *
 * `null` means THE POLL COULD NOT ASK, and it is not the same fact as the
 * service answering `unknown`. Collapsing the two told people their posts had
 * arrived because one request 500'd: `unknown` counts as settled, and settled
 * fell through to the success screen. Once the server has said `pending`, only
 * the server may say otherwise.
 *
 * Never throws; the caller decides what a silent poll means.
 */
export async function fetchSquareRekey(timeoutMs = 6_000): Promise<SquareRekey | null> {
  try {
    const res = await apiFetch(
      api("/api/migration/status"),
      { method: "GET", signal: AbortSignal.timeout(timeoutMs) },
      { requireAuth: true, breaker: false }
    );
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return body === null ? null : readSquareRekey(body);
  } catch {
    return null;
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

/**
 * Where this Decane sign-in stands relative to the old provider — asked by
 * the migration gate BEFORE the app's first Square call. Every failure is
 * `unknown`: linking off in this deployment, the service not answering, a
 * dropped request. The gate lets `unknown` through, because an outage must
 * not lock anybody out; the manual door stays.
 */
export async function fetchAccountState(email: string | null): Promise<AccountState> {
  try {
    const res = await apiFetch(
      api("/api/migration/account-state"),
      {
        method: "POST",
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(8_000),
      },
      { requireAuth: true, breaker: false }
    );
    if (!res.ok) return "unknown";
    const body = (await res.json().catch(() => null)) as { data?: { state?: unknown } } | null;
    const state = body?.data?.state;
    return state === "new" || state === "linked" || state === "legacy" ? state : "unknown";
  } catch {
    return "unknown";
  }
}
