"use client";

// Client-side session signal shared between the api client (not a hook) and
// the shell's SessionGuard (a component). The guard mirrors Privy's
// ready/authenticated pair in here; the api client uses it to tell "Privy is
// still warming up" (wait quietly) apart from "the session is gone" (log the
// user out properly, once).

interface AuthSnapshot {
  ready: boolean;
  authenticated: boolean;
}

let snapshot: AuthSnapshot = { ready: false, authenticated: false };
/**
 * Has this page EVER held an authenticated session?
 *
 * The difference between "your session ended" and "you were never signed in",
 * which the ready/authenticated pair alone cannot tell apart — both read
 * `{ ready: true, authenticated: false }`. Without it, the first gated request
 * a GUEST made was reported as an expiry: they were told their session had
 * expired, which was untrue, and bounced to /auth off a page they were allowed
 * to be reading. Signed-out browsing is a supported thing here, so that
 * redirect broke the front door.
 */
let everAuthenticated = false;
const readyWaiters = new Set<() => void>();
const expiryListeners = new Set<() => void>();

export function setAuthSnapshot(next: AuthSnapshot): void {
  snapshot = next;
  if (next.authenticated) everAuthenticated = true;
  if (next.ready) {
    readyWaiters.forEach((resolve) => resolve());
    readyWaiters.clear();
  }
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

/**
 * Whether a session was ever held here. Latches ON and never clears: after a
 * genuine expiry the reader HAS had one, and that is exactly when the expiry
 * path should still run.
 */
export function hasHeldSession(): boolean {
  return everAuthenticated;
}

// Resolves when Privy reports ready (or after the timeout, so a broken
// provider can never hang a request forever).
export function waitForAuthReady(timeoutMs = 8000): Promise<void> {
  if (snapshot.ready) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      readyWaiters.delete(done);
      resolve();
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    readyWaiters.add(done);
  });
}

// Fired by the api client when a call discovers the session is gone. The
// SessionGuard owns the actual logout UX (toast once, clear cache, redirect).
export function markSessionExpired(): void {
  expiryListeners.forEach((listener) => listener());
}

export function onSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}
