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
const readyWaiters = new Set<() => void>();
const expiryListeners = new Set<() => void>();

export function setAuthSnapshot(next: AuthSnapshot): void {
  snapshot = next;
  if (next.ready) {
    readyWaiters.forEach((resolve) => resolve());
    readyWaiters.clear();
  }
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
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
