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
 * THE ORDER IS THE OLD ACCOUNT FIRST, and that is the whole design. A
 * returning reader arrives wanting to sign in as themselves; asking them to
 * create a new account before proving who they are reads as being told their
 * account is gone. So: sign in to the old one, hear once that Square has moved,
 * set up the new sign-in, and the link fires ON ITS OWN — there is no button
 * for it.
 *
 * Doing it this way also closes a window. Signing in with the new account makes
 * an empty profile under the new id, which Square absorbs when the link
 * arrives — but only while nobody has touched it. Linking immediately after
 * that sign-in means nobody can. The other order left the reader loose in the
 * app with an empty account and a handle to invent, and inventing one refuses
 * the move for good.
 *
 * Reopening this page re-sends the link, which is how one that met a transient
 * outage gets finished (the call is idempotent by contract).
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
  if (DEMO_AUTH || !LEGACY_PRIVY_APP_ID) {
    return (
      <Frame title="Bring your old account">
        <p>Moving an old account isn&apos;t available in this build.</p>
      </Frame>
    );
  }

  // The provider wraps the WHOLE flow now, not just its second half: the old
  // account is the first thing asked for, so Privy has to be mounted before
  // anything is drawn. It still wraps this one route and nothing else.
  return (
    <LegacyPrivyProvider>
      <LinkFlow />
    </LegacyPrivyProvider>
  );
}

function LinkFlow() {
  const privy = usePrivy();
  const { identityToken } = useIdentityToken();
  const decane = useAuth();
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
    // BOTH sides, and the new one last. The link needs the old account's token
    // and the new account's bearer together, and asking for the old one first
    // is what lets this fire the moment the new account exists — before the
    // reader can do anything to the empty profile Square just made for them,
    // which is what would refuse the move for good.
    if (!privy.ready || !privy.authenticated || !decane.authenticated || started.current) return;
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
  }, [privy, decane.authenticated, identityToken, queryClient]);

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

  if (!privy.ready || !decane.ready) {
    return (
      <Frame title="Bring your old account">
        <Spinner className="mx-auto h-6 w-6 text-grey-500" />
      </Frame>
    );
  }

  // FIRST: the account they already have. A returning reader came here to sign
  // in as themselves, and asking them to make a new account before proving who
  // they are reads as being told their account is gone.
  if (!privy.authenticated && !outcome) {
    return (
      <Frame title="Sign in to your old account">
        <p>
          Sign in the same way you used to. Your handle, followers and posts come across in a
          moment.
        </p>
        <Button className="w-full" onClick={() => privy.login()}>
          Sign in to my old account
        </Button>
      </Frame>
    );
  }

  // THEN: what is actually happening, said once, before a second sign-in they
  // did not ask for arrives unexplained.
  if (!decane.authenticated && !outcome) {
    return (
      <Frame title="Welcome back — Square has moved">
        <p>
          Square accounts have moved to Market 2.0. Set up your new sign-in and everything you
          have — your handle, followers, posts and tips — comes with you. It takes a moment and
          you only do it once.
        </p>
        <Button className="w-full" onClick={decane.login}>
          Continue
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
