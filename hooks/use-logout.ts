"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { setBroadcastLive, useBroadcastStatus } from "@/hooks/use-broadcast-status";
import { unsubscribeThisBrowser } from "@/lib/push-client";
import { getRoomSession } from "@/lib/room-session-store";
import { sq } from "@/lib/square-path";

// One logout flow for every surface: confirm if a broadcast is on air, then
// Privy logout, drop every cached query (identity, tickets, feeds), clear the
// broadcast signal, and land on /auth.
export function useLogout(): () => Promise<void> {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const broadcast = useBroadcastStatus();

  return async () => {
    if (broadcast.live && !window.confirm("You're live — leaving stops your broadcast.")) {
      return;
    }
    // Forget this browser for push BEFORE the session ends (the request needs
    // it), so a shared browser never keeps getting the last person's pushes.
    // The gist room comes down FIRST, while the session that owns it can still
    // free a seat — the next person in this browser must not inherit the call.
    await getRoomSession().logout();
    await unsubscribeThisBrowser();
    setBroadcastLive(null);
    queryClient.clear();
    await Promise.resolve(logout()).catch(() => {});
    router.push(sq("/auth"));
  };
}
