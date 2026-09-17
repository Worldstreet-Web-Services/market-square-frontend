"use client";

import { useRouter } from "next/navigation";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { useAuth } from "@/hooks/use-auth";
import { sq } from "@/lib/square-path";

// Public browsing works signed-out; any gated action (post, follow, buy,
// chat) runs through this. Signed out, it opens the app's own sign-in card
// over the current page — never the auth vendor's modal, and never a
// navigation that would cost the reader their place in the feed.
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
    router.prefetch(sq("/auth"));
  };
}
