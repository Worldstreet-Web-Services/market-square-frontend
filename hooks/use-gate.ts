"use client";

import { useRouter } from "next/navigation";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { useAuth } from "@/hooks/use-auth";

// Public browsing works signed-out; any gated action (post, follow, buy,
// chat) runs through this. Signed out, it opens the login flow instead.
export function useGate(): (action: () => void) => void {
  const { ready, authenticated, login } = useAuth();
  const router = useRouter();
  return (action: () => void) => {
    if (!ready) return;
    if (authenticated) {
      action();
      return;
    }
    if (DEMO_AUTH) {
      action();
      return;
    }
    login();
    router.prefetch("/auth");
  };
}
