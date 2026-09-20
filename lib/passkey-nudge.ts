/**
 * WHEN TO OFFER A PASSKEY TO A DEVICE THAT FELL BACK TO A PIN.
 *
 * A device ends up on a PIN when no passkey was reachable at the moment the
 * wallet was made — a password manager that was not signed in, a dismissed
 * prompt, a browser without the right support. That is almost never a choice,
 * and the kit does not revisit it: once a PIN-wrapped share exists, every
 * unlock goes to the PIN however available passkeys later become.
 *
 * So the offer is worth repeating, because the reason it failed usually
 * changes. It is not worth repeating every sign-in, which is how a useful
 * prompt becomes one people dismiss without reading. A week is the compromise.
 *
 * The decision is pure and the storage is thin, so `node --test` can pin the
 * part that matters.
 */

const KEY = "ms.passkeyNudgeDeclinedAt";
const REOFFER_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Given what was recorded and the time now, is the offer due?
 *
 * Nothing recorded means never declined, so yes. An unparseable value means the
 * record is useless, and treating it as absent is the safe reading: a repeated
 * offer is a smaller harm than a device that silently never gets one.
 */
export function nudgeDue(recorded: string | null, now: number): boolean {
  if (recorded === null) return true;
  const at = Number(recorded);
  if (!Number.isFinite(at)) return true;
  return now - at > REOFFER_AFTER_MS;
}

export function passkeyNudgeDue(): boolean {
  try {
    return nudgeDue(window.localStorage.getItem(KEY), Date.now());
  } catch {
    // Storage unavailable. Offer it, for the same reason as above.
    return true;
  }
}

export function recordPasskeyNudgeDeclined(): void {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Nothing to record against; the offer comes back next time.
  }
}
