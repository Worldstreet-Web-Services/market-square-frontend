"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useIdentityToken, usePrivy } from "@privy-io/react-auth";
import { Button, Spinner } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_AUTH, LEGACY_PRIVY_APP_ID } from "@/lib/auth-mode";
import type { LinkOutcome } from "@/lib/migration-link";
import { sq } from "@/lib/square-path";
import { linkLegacyAccount } from "../lib/api";
import { LegacyPrivyProvider } from "./legacy-privy-provider";

/**
 * BRING YOUR OLD ACCOUNT — /move-account.
 *
 * Before the move to Decane, Square accounts lived on Privy, and a profile —
 * handle, followers, posts, likes, tips — is keyed to that old account. A
 * Decane sign-in is a new id, so without a link the reader arrives as a
 * stranger while their followers sit on an account they cannot sign into.
 *
 * The whole flow is: be signed in here, sign into the old account once. The
 * link then fires ON ITS OWN — there is no button for it — and Square moves the
 * profile. Reopening this page re-sends it, which is how a link that met a
 * transient outage gets finished (the call is idempotent by contract).
 *
 * What this page will not do is watch for the move to finish: Square does not
 * report it (llms-link.txt §3), so a recorded link is the end of the story here
 * and the profile simply is there afterwards.
 */
export function MoveAccountPage() {
  const { ready, authenticated, login } = useAuth();

  if (DEMO_AUTH || !LEGACY_PRIVY_APP_ID) {
    return (
      <Frame title="Bring your old account">
        <p>Moving an old account isn&apos;t available in this build.</p>
      </Frame>
    );
  }

  if (!ready) {
    return (
      <Frame title="Bring your old account">
        <Spinner className="mx-auto h-6 w-6 text-grey-500" />
      </Frame>
    );
  }

  if (!authenticated) {
    return (
      <Frame title="Bring your old account">
        <p>Sign in to Square first. Your old profile moves onto the account you sign in with.</p>
        <Button className="w-full" onClick={login}>
          Sign in
        </Button>
      </Frame>
    );
  }

  return (
    <LegacyPrivyProvider>
      <LinkFlow />
    </LegacyPrivyProvider>
  );
}

function LinkFlow() {
  const privy = usePrivy();
  const { identityToken } = useIdentityToken();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [outcome, setOutcome] = useState<LinkOutcome | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!privy.ready || !privy.authenticated || started.current) return;
    started.current = true;
    void (async () => {
      const accessToken = await privy.getAccessToken().catch(() => null);
      if (!accessToken) {
        setOutcome({ kind: "reauth" });
        return;
      }
      const result = await linkLegacyAccount({ accessToken, idToken: identityToken });
      setOutcome(result);
      if (result.kind === "linked") {
        // The profile moves asynchronously; the next /me read picks it up.
        void queryClient.invalidateQueries({ queryKey: ["ms", "me"] });
      }
      if (result.kind !== "reauth") {
        // The old session has done its one job. Leaving it signed in would
        // keep a second identity alive in this browser for no reason.
        await privy.logout().catch(() => {});
      }
    })();
  }, [privy, identityToken, queryClient]);

  const signInAgain = () => {
    started.current = false;
    setOutcome(null);
    void privy.logout().then(() => privy.login());
  };

  if (!privy.ready) {
    return (
      <Frame title="Bring your old account">
        <Spinner className="mx-auto h-6 w-6 text-grey-500" />
      </Frame>
    );
  }

  if (!privy.authenticated && !outcome) {
    return (
      <Frame title="Bring your old account">
        <p>
          Had a Square account before? Sign in to it once, the same way you used to, and your
          handle, followers and posts come across to this account.
        </p>
        <Button className="w-full" onClick={() => privy.login()}>
          Sign in to my old account
        </Button>
      </Frame>
    );
  }

  if (!outcome) {
    return (
      <Frame title="Bringing your account across">
        <Spinner className="mx-auto h-6 w-6 text-grey-500" />
      </Frame>
    );
  }

  switch (outcome.kind) {
    case "linked":
      return (
        <Frame title="You're all set">
          <p>
            Your old account is linked. Your profile, followers and posts move across in the
            background — it can take a minute to show.
          </p>
          <Button className="w-full" onClick={() => router.push(sq("/auth"))}>
            Done
          </Button>
        </Frame>
      );
    case "already-linked":
      return (
        <Frame title="That account is already linked">
          <p>
            One of these accounts is already linked to a different account, so we can&apos;t link
            them here. Contact support and we&apos;ll sort it out.
          </p>
        </Frame>
      );
    case "reauth":
      return (
        <Frame title="Sign in again">
          <p>We couldn&apos;t confirm one of the two sign-ins. Sign in to your old account again.</p>
          <Button className="w-full" onClick={signInAgain}>
            Sign in to my old account
          </Button>
        </Frame>
      );
    case "retry-later":
      return (
        <Frame title="Not finished yet">
          <p>
            We couldn&apos;t reach the service that links accounts. Nothing was changed. Come back
            to this page in a little while to finish.
          </p>
        </Frame>
      );
    case "unavailable":
      return (
        <Frame title="Not available right now">
          <p>Moving an old account isn&apos;t available right now.</p>
        </Frame>
      );
  }
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[80dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-5 text-center text-[15px] leading-normal text-meta">
        <h1 className="text-[24px] font-bold leading-[28px] text-white">{title}</h1>
        {children}
      </div>
    </div>
  );
}
