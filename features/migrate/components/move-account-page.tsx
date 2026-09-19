"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useIdentityToken, usePrivy } from "@privy-io/react-auth";
import { Button, Spinner } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_AUTH, LEGACY_PRIVY_APP_ID } from "@/lib/auth-mode";
import { squareSettled, type LinkOutcome, type SquareRekey } from "@/lib/migration-link";
import { sq } from "@/lib/square-path";
import { fetchSquareRekey, linkLegacyAccount } from "../lib/api";

/**
 * How long to wait for Square to finish moving the profile before saying so
 * plainly. The synchronous re-key answers inside the link itself, so reaching
 * this ceiling means the move is going through the queue and the worker is
 * behind — which the reader should be told, not shown as a spinner that never
 * ends. That exact spinner-versus-outage ambiguity is what made a broken
 * migration invisible for days.
 */
const SQUARE_WAIT_MS = 30_000;
const SQUARE_POLL_MS = 2_500;
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
 * This page DOES watch for the move to finish. It used not to — Square did not
 * report the re-key, so a recorded link was the end of the story here and the
 * profile was assumed to be there afterwards. Square now answers with
 * `rekey.square`, so the three cases that used to look identical are told
 * apart: done, still going, and refused because this account already has a
 * profile. Announcing success over that last one is how somebody loses their
 * followers quietly.
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
  // Where Square says the profile move itself got to, separately from whether
  // the pairing was recorded. `waiting` is true only while it is `pending` and
  // we are still inside the ceiling.
  const [square, setSquare] = useState<SquareRekey>("unknown");
  const [waiting, setWaiting] = useState(false);
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
      setOutcome(result.outcome);
      setSquare(result.square);
      if (result.outcome.kind === "linked") {
        // Wait for the move rather than announcing success over it: sending
        // the reader on during `pending` lands them on a profile that does not
        // have their posts yet, which reads as data loss.
        if (result.square === "pending") setWaiting(true);
        else void queryClient.invalidateQueries({ queryKey: ["ms", "me"] });
      }
      if (result.outcome.kind !== "reauth") {
        // The old session has done its one job. Leaving it signed in would
        // keep a second identity alive in this browser for no reason.
        await privy.logout().catch(() => {});
      }
    })();
  }, [privy, identityToken, queryClient]);

  // Poll only while the move is in flight. Every exit clears the timer, and a
  // poll that cannot answer reads as `unknown`, which ends the wait — a
  // spinner that outlives the thing it is waiting for is the failure mode this
  // whole screen exists to avoid.
  useEffect(() => {
    if (!waiting) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    const tick = async () => {
      const state = await fetchSquareRekey();
      if (!live) return;
      if (squareSettled(state)) {
        setSquare(state);
        setWaiting(false);
        if (state !== "failed") void queryClient.invalidateQueries({ queryKey: ["ms", "me"] });
        return;
      }
      if (Date.now() - startedAt >= SQUARE_WAIT_MS) {
        // Still pending, and we stop asking. The copy below says so rather
        // than claiming it finished.
        setWaiting(false);
        return;
      }
      timer = setTimeout(() => void tick(), SQUARE_POLL_MS);
    };
    timer = setTimeout(() => void tick(), SQUARE_POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [waiting, queryClient]);

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
      // The pairing is recorded. What happened to the PROFILE is a separate
      // question, and the three answers need opposite words.
      if (waiting) {
        return (
          <Frame title="Bringing your profile across">
            <p>Your handle, followers and posts are moving onto this account now.</p>
            <Spinner className="mx-auto h-6 w-6 text-grey-500" />
          </Frame>
        );
      }
      if (square === "failed") {
        // Square refused the move: the new id already owns a real profile, so
        // the person is split. Calling this "all set" is how somebody loses
        // their followers quietly.
        return (
          <Frame title="Your accounts need a hand">
            <p>
              Your accounts are linked, but your old profile could not move across because this
              account already has one. Contact support and we&apos;ll join them up — nothing is
              lost.
            </p>
            <Button className="w-full" onClick={() => router.push(sq("/auth"))}>
              Done
            </Button>
          </Frame>
        );
      }
      if (square === "pending") {
        return (
          <Frame title="Still finishing">
            <p>
              Your old account is linked and your profile is on its way, but it is taking longer
              than usual. It will appear on its own — check back shortly.
            </p>
            <Button className="w-full" onClick={() => router.push(sq("/auth"))}>
              Done
            </Button>
          </Frame>
        );
      }
      return (
        <Frame title="You're all set">
          <p>
            Your old account is linked. Your handle, followers and posts are on this account now.
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
