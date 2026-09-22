"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { onSessionExpired, setAuthSnapshot, type SessionEndReason } from "@/lib/session";
import { useAuth } from "@/hooks/use-auth";
import { useBroadcastStatus } from "@/hooks/use-broadcast-status";
import { sq, stripSquare } from "@/lib/square-path";

// Owns the "session expired" UX. Two triggers, one flow:
// - reactive: the api client discovered a missing session mid-request;
// - proactive: the session reports ready && !authenticated while we still hold
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

  // Mirror session state for the non-hook api client.
  useEffect(() => {
    setAuthSnapshot({ ready, authenticated });
  }, [ready, authenticated]);

  // A fresh login re-arms the guard for the next expiry.
  useEffect(() => {
    if (authenticated) handled.current = false;
  }, [authenticated]);

  useEffect(() => {
    if (DEMO_AUTH) return;

    const expire = (reason: SessionEndReason) => {
      if (handled.current) return;
      // Declining the live-broadcast prompt ABORTS this expiry: the guard must
      // stay armed so the next one still fires. Marking it handled up front
      // disarmed it permanently the first time a streamer said "no", and the
      // session then sat expired forever with no further prompt.
      if (broadcast.live && !window.confirm("You're live — leaving stops your broadcast.")) {
        return; // stay on the cockpit; the user chose to keep streaming
      }
      handled.current = true;
      queryClient.removeQueries({ queryKey: ["ms", "me"] });
      // An account that has MOVED did not expire, and "sign in again" would
      // point at the sign-in that was just refused. Say which door.
      toast.error(
        reason === "upgraded"
          ? "Your account has been upgraded — sign in with your new account."
          : "Session expired — sign in again."
      );
      // Logical route: usePathname() answers /square/auth since the move.
      if (stripSquare(pathname) !== "/auth") {
        const params = new URLSearchParams({ returnTo: pathname });
        if (reason === "upgraded") params.set("upgraded", "1");
        router.push(sq(`/auth?${params.toString()}`));
      }
    };

    // Reactive: fired by apiFetch.
    const unsubscribe = onSessionExpired(expire);

    // Proactive: the session settled as logged-out while we still show a profile.
    if (ready && !authenticated && queryClient.getQueryData(["ms", "me"])) {
      expire("expired");
    }

    return unsubscribe;
  }, [ready, authenticated, pathname, router, queryClient, broadcast.live]);

  return null;
}
