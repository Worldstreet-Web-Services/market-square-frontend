/**
 * Fetches the upload contract from the backend.
 *
 * WHY THIS EXISTS: the size caps and the content-type allowlist were written
 * out by hand in two repositories — here, for the instant client-side check,
 * and in `apps/market-square`, which actually enforces them. Two owners of one
 * contract has exactly two failure modes, and we shipped both:
 *
 *   - server raised, client not → the composer refuses a photo the service
 *     would have stored, and the user has no way to tell it is our bug.
 *   - client raised, server not → the upload runs to completion over a phone
 *     connection and fails at the end.
 *
 * Neither is visible in review, and neither fails CI, because the two numbers
 * live in repositories that never see each other. So the server publishes them
 * (`GET /uploads/limits`, public) and this module reads them.
 *
 * What does NOT change: validation still happens BEFORE a single byte is sent,
 * so the user gets an immediate, specific error naming the cap and their file's
 * actual size. This module only decides which numbers that check uses.
 *
 * Deliberately free of `@/` aliases, Privy and `next/*` so it runs under
 * `node --test` alongside the rules it feeds.
 */

import { FALLBACK_LIMITS, setUploadLimits, type UploadLimits } from "./upload-rules.ts";
import { api } from "./square-path.ts";

/** The BFF path. Same-origin, so no base URL and no credentials handling. */
export const UPLOAD_LIMITS_PATH = api("/api/market-square/uploads/limits");

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * One fetch per page load, shared by every caller.
 *
 * Memoised on the PROMISE, not the result, so a composer and an avatar picker
 * opening at the same moment make one request between them rather than two.
 */
let inFlight: Promise<UploadLimits> | null = null;

/**
 * Read the contract once and adopt it.
 *
 * Never rejects. A failure here must not block the user from picking a file —
 * it degrades to the compiled-in fallback, which is the current server default,
 * and validation carries on. A caller that wants to know can compare the result
 * against `FALLBACK_LIMITS`.
 *
 * On failure the memo is CLEARED, so the next upload attempt tries again rather
 * than pinning a whole session to the fallback because of one flaky request.
 */
export function ensureUploadLimits(fetcher?: Fetcher): Promise<UploadLimits> {
  if (inFlight) return inFlight;
  const call = fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init));
  inFlight = (async () => {
    try {
      const response = await call(UPLOAD_LIMITS_PATH, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const envelope = (await response.json()) as {
        success?: boolean;
        data?: Partial<UploadLimits>;
      };
      if (envelope?.success !== true || !envelope.data) throw new Error("unexpected envelope");
      return setUploadLimits(envelope.data);
    } catch {
      // Silent by design. The user is picking a file; a toast about a config
      // endpoint tells them nothing they can act on, and the fallback means
      // nothing is actually broken for them.
      inFlight = null;
      return FALLBACK_LIMITS;
    }
  })();
  return inFlight;
}

/** Test seam — forgets the memoised request. */
export function resetUploadLimitsCache(): void {
  inFlight = null;
}
