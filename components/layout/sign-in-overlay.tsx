"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SignInCard } from "@/features/profile";
import { PasskeyStep } from "@/components/layout/passkey-step";
import { useDevicePasskey } from "@/hooks/use-device-passkey";
import { passkeyNudgeDue } from "@/lib/passkey-nudge";
import { useAuth } from "@/hooks/use-auth";
import { stripSquare } from "@/lib/square-path";
import {
  closeSignIn,
  getSignInOpen,
  getSignInOpenServer,
  subscribeSignIn,
} from "@/lib/signin-store";

/**
 * THE APP'S ONE SIGN-IN SURFACE, over whatever the reader was looking at.
 *
 * Mounted once beside the composer and the ticker sheet — the same pattern, for
 * the same reason: `useAuth().login` is called from a dozen places that have no
 * business knowing what a sign-in card looks like, so the card is owned here
 * and opened through a module store (`lib/signin-store.ts`, which carries the
 * why).
 *
 * It composes across slices — the card belongs to `features/profile`, which
 * owns identity — so it lives in the layout layer like `home-screen` and
 * `messages-screen`.
 *
 * ─── IT IS DISMISSIBLE, AND THAT IS DELIBERATE ──────────────────────────────
 * A reader reaches this by tapping a like, a follow, or Sign in — none of which
 * is a commitment to sign in. Closing puts them back exactly where they were,
 * with their scroll intact, which is the one thing the vendor modal did well.
 *
 * `z-[80]` sits under the welcome sequence (90) and the splash (100), both of
 * which own the screen outright when they are up, and over every piece of app
 * chrome, the highest of which is 60.
 */
export function SignInOverlay() {
  const open = useSyncExternalStore(subscribeSignIn, getSignInOpen, getSignInOpenServer);
  const { authenticated } = useAuth();
  /*
    ONE SCREEN BEFORE IT CLOSES.

    A device that could hold a passkey but is on a PIN is offered one, here,
    because this is the only surface every sign-in passes through and the
    payoff lands on the very next one. `canAdd` is null until the check
    resolves, and the overlay waits on it rather than closing and reopening.

    Offered after the sign-in has already succeeded, so a dismissed
    authenticator sheet can never cost somebody their session.
  */
  const { canAdd, needsReauth } = useDevicePasskey();
  const [stepDone, setStepDone] = useState(false);
  /*
    Never over the account move. Signing in from /move-account completes the
    link moments later, and a full-screen sheet at z-80 would sit on top of its
    outcome — including the "your accounts need a hand" frame, which is the one
    a reader most needs to see. The offer keeps until their next sign-in.
  */
  const onMoveAccount = stripSquare(usePathname()) === "/move-account";
  const offerPasskey =
    authenticated &&
    !stepDone &&
    !onMoveAccount &&
    canAdd === true &&
    !needsReauth &&
    passkeyNudgeDue();
  const holdOpen = authenticated && !stepDone && !onMoveAccount && canAdd === null;

  /*
    Signing in closes it. Not a `setState` in an effect — this writes to the
    module store, which is where the flag lives — but it does have to be an
    effect: without clearing the flag, signing out later would drop the reader
    straight back into a card they never asked for.
  */
  useEffect(() => {
    if (authenticated && !offerPasskey && !holdOpen) closeSignIn();
  }, [authenticated, offerPasskey, holdOpen]);

  if (!open) return null;
  if (offerPasskey) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add a passkey"
        className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#0F0F0F]"
      >
        <PasskeyStep onDone={() => setStepDone(true)} />
      </div>
    );
  }
  if (authenticated) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#0F0F0F]"
    >
      {/* The card's own "look around" affordance is the way out, so the overlay
          needs no second dismiss control competing with it. */}
      <SignInCard onSkip={closeSignIn} />
    </div>
  );
}
