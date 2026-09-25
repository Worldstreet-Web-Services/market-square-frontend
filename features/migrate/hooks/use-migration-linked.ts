"use client";

import { useQuery } from "@tanstack/react-query";
import { DEMO_AUTH, LEGACY_PRIVY_APP_ID } from "@/lib/auth-mode";
import { useAuth } from "@/hooks/use-auth";
import { fetchMigrationLinked } from "../lib/api";

/**
 * Whether this account has already been joined to an old one.
 *
 * Read by the offer before the username claim, so somebody who has already
 * moved is not asked again. Answers `null` while it is loading and whenever it
 * cannot tell, and the offer treats that as "ask anyway" — the safe direction.
 *
 * Long-lived on purpose: linking happens once, and the answer only ever goes
 * false→true, at which point the flow that changed it invalidates this key.
 */
export function useMigrationLinked(): boolean | null {
  const { ready, authenticated } = useAuth();
  const query = useQuery<boolean | null>({
    queryKey: ["ms", "migration", "linked"],
    // Not asked where linking does not exist. Without this every new user's
    // onboarding paid a round trip that 503s, on the critical path, for an
    // answer the caller then ignores.
    enabled: ready && authenticated && !DEMO_AUTH && Boolean(LEGACY_PRIVY_APP_ID),
    queryFn: fetchMigrationLinked,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  return query.data ?? null;
}
