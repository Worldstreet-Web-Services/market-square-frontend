/**
 * DID THIS READER ASK FOR THIS OLD SESSION, OR WAS IT JUST LYING AROUND?
 *
 * Privy keeps its session in the browser and restores it on load, so
 * `authenticated` can be true for somebody who never signed in here — a
 * session left by the old app, or by whoever used this machine before. Those
 * keys belong to the BROWSER, not the person, and linking is permanent: a
 * wrong pairing answers LEGACY_ALREADY_LINKED from then on. So a session
 * nobody asked for is signed out rather than spent.
 *
 * "Nobody asked for it" cannot be decided by looking at the session, because a
 * Google or X sign-in LEAVES the page and comes back to the same URL — and on
 * the way back it looks exactly like a leftover. So intent is recorded before
 * leaving and read on return.
 *
 * `sessionStorage`, not `localStorage`, and that is the whole point: it
 * survives a redirect in this tab and nothing else. A new tab, a new window or
 * a reopened browser starts with no intent, which is precisely when a restored
 * session should be treated as somebody else's.
 */

const KEY = "ms:migration:signing-in";

/** Called immediately before handing off to the old provider's sign-in. */
export function markLegacySignIn(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage blocked. The session that comes back reads as a leftover and is
    // signed out — the safe direction: it costs a retry, never a wrong link.
  }
}

/** Whether a sign-in from this tab is what produced the session on screen. */
export function legacySignInIntended(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
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
