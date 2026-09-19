"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSocialAuth } from "decane-connect-kit";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { openSignIn } from "@/lib/signin-store";

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void> | void;
}

/**
 * The kit persists a signed-in identity under this localStorage prefix and
 * hydrates it asynchronously after init, with no "ready" flag of its own. So
 * this is the only way to tell "still hydrating a known reader" from "signed
 * out". Coupled to the kit's storage layout on purpose, as wsws is; revisit on
 * kit upgrades.
 */
const DECANE_IDENTITY_KEY_PREFIX = "decane:social:";

function hasPersistedIdentity(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DECANE_IDENTITY_KEY_PREFIX) && localStorage.getItem(key)) return true;
    }
  } catch {
    // Storage blocked: no identity, and the sign-in card still works.
  }
  return false;
}

/** If kit init hangs (network, bad key), stop holding "not ready" forever. */
const HYDRATION_GRACE_MS = 8_000;

const emptySubscribe = () => () => {};

function useDecaneAuth(): AuthState {
  const social = useSocialAuth();
  // Server renders have no localStorage, so both sides render "not ready" first
  // and the client flips after hydration — the mismatch-safe way to say that.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGraceOver(true), HYDRATION_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  /*
    Addresses alone are NOT a session. After a tab closes, Decane remembers WHO
    the reader is but holds no JWT (`needsReconnect`), so every authed call
    would starve. Reading that state as signed-out routes them through the
    sign-in card, where one Google round trip or email code restores a session.
  */
  const authenticated = Boolean(social.addresses?.evm) && !social.needsReconnect;

  return {
    ready: mounted && (authenticated || graceOver || !hasPersistedIdentity()),
    authenticated,
    // OURS, not the kit's modal: every route into signing in lands on the
    // designed card (`openSignIn`), which drives the kit headlessly.
    login: openSignIn,
    logout: () => social.disconnect(),
  };
}

// Demo mode mounts no Decane provider, so the session is simply assumed; the
// fixture BFF treats every caller as the demo user.
function useDemoAuth(): AuthState {
  return { ready: true, authenticated: true, login: () => {}, logout: () => {} };
}

export const useAuth: () => AuthState = DEMO_AUTH ? useDemoAuth : useDecaneAuth;
