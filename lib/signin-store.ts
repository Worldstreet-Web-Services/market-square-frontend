"use client";

/**
 * WHETHER THE SIGN-IN CARD IS OPEN — a module store, read through
 * `useSyncExternalStore`, exactly as `ticker-store` is.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Four surfaces invite a signed-out reader to sign in: the chrome's button, the
 * mobile drawer, `SignInPrompt` on a gated surface, and `useGate` on a gated
 * action. Every one of them called `usePrivy().login()`, which opens PRIVY'S
 * OWN BRANDED MODAL — so the product had a sign-in card built to the design
 * that a reader could only reach on their very first visit, and every route to
 * it afterwards showed the vendor's dialog instead.
 *
 * Naming the auth vendor to the reader is the one thing that surface must not
 * do. `useAuth().login` now opens this instead, which means the fix is at the
 * source: no existing call site had to change, and a new one cannot get it
 * wrong by calling the obvious function.
 *
 * ─── WHY AN OVERLAY AND NOT A NAVIGATION ────────────────────────────────────
 * `/auth` renders the same card and is still there — it is what a shared link
 * or an expired session lands on. But sending somebody to it from a like button
 * means losing their place in the feed. The overlay keeps the page underneath
 * mounted, scrolled and correct, which is what the vendor modal was doing well
 * and the only part of it worth keeping.
 *
 * No context and no store library: `components/ui/*` cannot import `features/*`,
 * and threading a callback through every surface that renders a like button is
 * a prop nobody reads.
 */
let open = false;
let listeners: (() => void)[] = [];

function emit() {
  for (const listener of listeners) listener();
}

export function openSignIn(): void {
  if (open) return;
  open = true;
  emit();
}

export function closeSignIn(): void {
  if (!open) return;
  open = false;
  emit();
}

export function subscribeSignIn(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getSignInOpen(): boolean {
  return open;
}

/** The server never has one open, and neither does the first client render. */
export function getSignInOpenServer(): boolean {
  return false;
}
