/**
 * DID THIS READER ASK FOR THIS OLD SESSION, OR WAS IT JUST LYING AROUND?
 *
 * Privy keeps its session in the browser and restores it on load, so
 * `authenticated` can be true for somebody who never signed in here — a
 * session left by the old app, by whoever used this machine before, or by
 * the previous account to go through this flow in this very tab. Those keys
 * belong to the BROWSER, not the person, and linking is permanent: a wrong
 * pairing answers LEGACY_ALREADY_LINKED from then on. So a session nobody
 * asked for is signed out rather than spent.
 *
 * "Nobody asked for it" cannot be decided by looking at the session, because a
 * Google or X sign-in LEAVES the page and comes back to the same URL — and on
 * the way back it looks exactly like a leftover. So intent is recorded before
 * leaving and read on return.
 *
 * TWO THINGS MAKE THE RECORD SAFE TO TRUST, and both were learned the hard
 * way. It names the new account that asked, so a different sign-in can never
 * spend it: one test account's old session was linked to the NEXT test
 * account, because the marker from the first flow was still there. And it
 * expires, so a marker that was never cleared — a tab left mid-flow, a crash
 * between the redirect and the link — cannot vouch for a session hours later.
 *
 * `sessionStorage`, not `localStorage`, for the same reason: it survives a
 * redirect in this tab and nothing else. A new tab or a reopened browser
 * starts with no intent, which is precisely when a restored session should
 * be treated as somebody else's.
 */

const KEY = "ms:migration:signing-in";

/** Long enough for a provider round trip and a slow reader; short enough to forget. */
const INTENT_TTL_MS = 10 * 60 * 1000;

interface Intent {
  /** The new account that asked — its EVM address — or null when it did not exist yet. */
  owner: string | null;
  at: number;
}

/**
 * Whether a recorded intent vouches for the session in front of `owner` now.
 *
 * Pure, so `node --test` can pin it. Unparseable or expired is "no", and so is
 * a record made under a different new account. A record made before the new
 * account existed (`owner: null` — the /move-account order, old account
 * first) vouches for whoever the new account turns out to be: there was no
 * other account in this tab to confuse it with, and the TTL bounds it.
 */
export function intentIsLive(recorded: string | null, owner: string | null, now: number): boolean {
  if (!recorded) return false;
  let intent: Intent;
  try {
    intent = JSON.parse(recorded) as Intent;
  } catch {
    return false;
  }
  if (typeof intent?.at !== "number" || now - intent.at > INTENT_TTL_MS || now < intent.at) {
    return false;
  }
  if (intent.owner === null) return true;
  return owner !== null && intent.owner === owner;
}

/** Called immediately before handing off to the old provider's sign-in. */
export function markLegacySignIn(owner: string | null): void {
  try {
    const intent: Intent = { owner, at: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // Storage blocked. The session that comes back reads as a leftover and is
    // signed out — the safe direction: it costs a retry, never a wrong link.
  }
}

/** Whether a sign-in from this tab, for THIS new account, produced the session on screen. */
export function legacySignInIntended(owner: string | null): boolean {
  try {
    return intentIsLive(sessionStorage.getItem(KEY), owner, Date.now());
  } catch {
    return false;
  }
}

/** Cleared once the link is done with it, so a later visit starts honest. */
export function clearLegacySignIn(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the tab closing clears it anyway.
  }
}
