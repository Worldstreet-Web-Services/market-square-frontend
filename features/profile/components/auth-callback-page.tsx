"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSocialAuth } from "decane-connect-kit";
import { Spinner } from "@/components/ui/button";
import { SquareLockup } from "@/components/ui/square-mark";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { useAuth } from "@/hooks/use-auth";
import { sq } from "@/lib/square-path";

/**
 * WHERE GOOGLE AND X COME BACK TO — /auth/callback.
 *
 * ─── WHY ITS OWN ROUTE ──────────────────────────────────────────────────────
 * The return leg is not a sign-in screen and must not look like one. Landing on
 * `/auth` showed the reader the sign-in card AGAIN — that route renders it
 * whenever nobody is authenticated, and on the way back from the provider
 * nobody is yet: the kit is still turning the credentials in the URL into a
 * session. Coming back from Google to "sign in" reads as a failed sign-in.
 *
 * `/auth` is also a welcome surface (lib/welcome-surface), so a reader on a
 * fresh browser could return from the provider into the four-screen welcome
 * carousel. Neither gate matches this path, which is the point of it.
 *
 * ─── WHY IT SHOWS SOMETHING ─────────────────────────────────────────────────
 * `showStatusOverlay: false` in app/providers.tsx suppresses the kit's own
 * full-screen status, because the app owns what the reader sees. The kit's
 * documentation is blunt about the deal that makes: suppress it and show
 * something of your own, because a silent multi-second pause reads as a broken
 * page. Nothing in the app did. This is that something.
 *
 * Creating a wallet is the slow case, and the one that can raise an
 * authenticator sheet on top of this screen, so it is named separately from
 * simply reopening a session.
 *
 * The kit reads the `decane_*` parameters off whatever URL it lands on and
 * clears them itself, so there is nothing to parse here. This waits, says which
 * of the two is happening, and gets out of the way.
 */
export function AuthCallbackPage() {
  const { phase } = useSocialAuth();
  const { ready, authenticated } = useAuth();
  const router = useRouter();
  const sent = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || sent.current) return;
    sent.current = true;
    // `replace`, never `push`: the callback URL still carries the credentials
    // that brought them here, and Back must not return to it.
    router.replace(sq("/"));
  }, [ready, authenticated, router]);

  /*
    Arriving here signed out and with nothing in flight means the credentials
    were missing, already spent, or refused — a stale bookmark, a Back into a
    consumed URL, or a provider that said no. There is nothing to wait for, so
    the reader is sent to sign in rather than left watching a spinner.
  */
  useEffect(() => {
    if (DEMO_AUTH || !ready || authenticated || phase !== null || sent.current) return;
    const timer = setTimeout(() => {
      if (sent.current) return;
      sent.current = true;
      router.replace(sq("/auth"));
    }, 4_000);
    return () => clearTimeout(timer);
  }, [ready, authenticated, phase, router]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#0F0F0F] px-4">
      <SquareLockup className="[--lockup-mark:80px]" />
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-grey-500" />
        <p role="status" className="text-[15px] text-[#999999]">
          {phase === "creating" ? "Setting up your account…" : "Signing you in…"}
        </p>
      </div>
    </div>
  );
}
