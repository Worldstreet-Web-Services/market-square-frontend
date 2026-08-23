"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { onSessionExpired, setAuthSnapshot } from "@/lib/session";
import { useAuth } from "@/hooks/use-auth";
import { useBroadcastStatus } from "@/hooks/use-broadcast-status";

// Owns the "session expired" UX. Two triggers, one flow:
// - reactive: the api client discovered a missing session mid-request;
// - proactive: Privy reports ready && !authenticated while we still hold
//   cached identity (the UI would otherwise keep rendering "logged in").
// The flow runs once per expiry: toast, drop cached identity, route to /auth
// with returnTo. An active broadcast is never silently killed — the redirect
// asks the same leave-confirmation first and stays put if declined.
export function SessionGuard() {
  const { ready, authenticated } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const broadcast = useBroadcastStatus();
  const handled = useRef(false);

  // Mirror Privy state for the non-hook api client.
  useEffect(() => {
    setAuthSnapshot({ ready, authenticated });
  }, [ready, authenticated]);

  // A fresh login re-arms the guard for the next expiry.
  useEffect(() => {
    if (authenticated) handled.current = false;
  }, [authenticated]);

  useEffect(() => {
    if (DEMO_AUTH) return;

    const expire = () => {
      if (handled.current) return;
      handled.current = true;
      queryClient.removeQueries({ queryKey: ["ms", "me"] });
      toast.error("Session expired — sign in again.");
      if (broadcast.live && !window.confirm("You're live — leaving stops your broadcast.")) {
        return; // stay on the cockpit; the user chose to keep streaming
      }
      if (pathname !== "/auth") {
        router.push(`/auth?returnTo=${encodeURIComponent(pathname)}`);
      }
    };

    // Reactive: fired by apiFetch.
    const unsubscribe = onSessionExpired(expire);

    // Proactive: Privy settled as logged-out while we still show a profile.
    if (ready && !authenticated && queryClient.getQueryData(["ms", "me"])) {
      expire();
    }

    return unsubscribe;
  }, [ready, authenticated, pathname, router, queryClient, broadcast.live]);

  return null;
}
