"use client";

import { usePrivy } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { openSignIn } from "@/lib/signin-store";

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void> | void;
}

function usePrivyAuth(): AuthState {
  const { ready, authenticated, logout } = usePrivy();
  /*
    `login` is OURS, not Privy's.

    `usePrivy().login` opens the vendor's own branded modal. Four surfaces call
    this — the chrome's Sign in, the mobile drawer, `SignInPrompt` and
    `useGate` — so every route into signing in named the vendor, and the card
    built to the design was reachable only on a reader's first visit.

    Swapping it here fixes all four at once and means a new call site cannot get
    it wrong by calling the obvious function. The card itself signs people in
    through the HEADLESS hooks, so nothing is lost but the dialog.
  */
  return { ready, authenticated, login: openSignIn, logout };
}

// Demo mode has no Privy provider mounted, so the session is simply assumed;
// the fixture BFF treats every caller as the demo user.
function useDemoAuth(): AuthState {
  return { ready: true, authenticated: true, login: () => {}, logout: () => {} };
}

export const useAuth: () => AuthState = DEMO_AUTH ? useDemoAuth : usePrivyAuth;
