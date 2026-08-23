"use client";

import { usePrivy } from "@privy-io/react-auth";
import { DEMO_AUTH } from "@/lib/auth-mode";

export interface AuthState {
  ready: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => Promise<void> | void;
}

function usePrivyAuth(): AuthState {
  const { ready, authenticated, login, logout } = usePrivy();
  return { ready, authenticated, login, logout };
}

// Demo mode has no Privy provider mounted, so the session is simply assumed;
// the fixture BFF treats every caller as the demo user.
function useDemoAuth(): AuthState {
  return { ready: true, authenticated: true, login: () => {}, logout: () => {} };
}

export const useAuth: () => AuthState = DEMO_AUTH ? useDemoAuth : usePrivyAuth;
