"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { setBroadcastLive, useBroadcastStatus } from "@/hooks/use-broadcast-status";

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
    setBroadcastLive(null);
    queryClient.clear();
    await Promise.resolve(logout()).catch(() => {});
    router.push("/auth");
  };
}
