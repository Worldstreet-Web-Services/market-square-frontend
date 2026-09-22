/**
 * THE MIGRATION GATE'S DECISION, and the little the browser remembers for it.
 *
 * A Decane sign-in whose old Square profile is still keyed to a Privy DID
 * makes an EMPTY profile under the new id on its first authenticated call,
 * and the moment anything touches that profile — a settings row, a presence
 * write, a claimed handle — the re-key refuses for good and the person is
 * two accounts. Seen live within three minutes of a sign-in.
 *
 * So the gate asks first, and renders nothing that talks to Square until it
 * has an answer. The decision is pure and the storage is thin, so `node
 * --test` can pin the part that matters.
 */

export type AccountState = "new" | "linked" | "legacy" | "unknown";

export type GateDecision = "app" | "checking" | "upgrade";

export function gateDecision(input: {
  /** Linking exists in this deployment at all. */
  enabled: boolean;
  ready: boolean;
  authenticated: boolean;
  /** Undefined while the answer is on its way. */
  state: AccountState | undefined;
  /** The person said "continue as a new account" for this sign-in. */
  dismissed: boolean;
}): GateDecision {
  // Signed-out browsing is a supported thing here, and a deployment without
  // linking has nothing to gate on.
  if (!input.enabled || !input.ready || !input.authenticated) return "app";
  if (input.state === undefined) return "checking";
  if (input.state === "legacy" && !input.dismissed) return "upgrade";
  return "app";
}

// ── what the browser remembers, per sign-in ─────────────────────────────────

const STATE_KEY = "ms.accountState";
const DISMISSED_KEY = "ms.upgradeDeclined";
const EMAIL_KEY = "ms.signInEmail";

/**
 * Answers worth keeping. `linked` and `new` are settled for a sign-in and
 * skip the round trip next time; `legacy` is asked again every load, because
 * it is the one that changes (by linking) and the one a stale copy would
 * keep showing after the fact. `unknown` is a shrug and is never kept.
 */
export function readCachedAccountState(storage: Storage | null, key: string): AccountState | undefined {
  try {
    const value = storage?.getItem(`${STATE_KEY}.${key}`);
    return value === "linked" || value === "new" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedAccountState(storage: Storage | null, key: string, state: AccountState): void {
  try {
    if (state === "linked" || state === "new") storage?.setItem(`${STATE_KEY}.${key}`, state);
    else storage?.removeItem(`${STATE_KEY}.${key}`);
  } catch {
    // Nothing to remember against; it is asked again next time.
  }
}

export function upgradeDeclined(storage: Storage | null, key: string): boolean {
  try {
    return storage?.getItem(`${DISMISSED_KEY}.${key}`) === "1";
  } catch {
    return false;
  }
}

export function recordUpgradeDeclined(storage: Storage | null, key: string): void {
  try {
    storage?.setItem(`${DISMISSED_KEY}.${key}`, "1");
  } catch {
    // Nothing to record against; they are asked again next time.
  }
}

/**
 * The sign-in email, kept from the moment the provider released it. Decane
 * stores no profile, so after a reload there is nothing to read it from —
 * and without it the gate could not ask. Keyed by the account, so a second
 * sign-in on the same browser never inherits the first one's address.
 */
export function rememberSignInEmail(storage: Storage | null, key: string, email: string | undefined): void {
  if (!email) return;
  try {
    storage?.setItem(`${EMAIL_KEY}.${key}`, email);
  } catch {
    // Storage unavailable: the gate asks with whatever the session still has.
  }
}

export function recallSignInEmail(storage: Storage | null, key: string): string | null {
  try {
    return storage?.getItem(`${EMAIL_KEY}.${key}`) ?? null;
  } catch {
    return null;
  }
}
