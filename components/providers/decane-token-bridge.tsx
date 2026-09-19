"use client";

import { useEffect } from "react";
import { useSocialWallet } from "decane-connect-kit";
import { useAuth } from "@/hooks/use-auth";
import { registerDecaneTokenSource } from "@/lib/auth-token";
import { clearDecaneSessionCookie, syncDecaneSessionCookie } from "@/lib/decane-session-cookie";

/**
 * Hands the kit's access-token getter to the transport (`lib/auth-token.ts`),
 * and mirrors the token into the `decane-token` cookie. Renders nothing; must
 * sit inside DecaneKit.
 *
 * The cookie is POLLED rather than written once: the kit hydrates its session
 * after mount and rotates the token later while `getAccessToken` keeps the same
 * identity, so there is no dependency to react to. A null token is almost
 * always the kit mid-rotation, not a sign-out, so only a SETTLED signed-out
 * session clears the cookie — clearing on every null made it flicker (wsws
 * learned that one).
 */
export function DecaneTokenBridge() {
  const { getAccessToken } = useSocialWallet();
  const { ready, authenticated } = useAuth();

  useEffect(() => {
    registerDecaneTokenSource(getAccessToken);
    return () => registerDecaneTokenSource(null);
  }, [getAccessToken]);

  useEffect(() => {
    const sync = () => {
      const token = getAccessToken();
      if (token) return syncDecaneSessionCookie(token);
      if (ready && !authenticated) clearDecaneSessionCookie();
    };
    sync();
    const timer = setInterval(sync, 2_000);
    return () => clearInterval(timer);
  }, [getAccessToken, ready, authenticated]);

  return null;
}
