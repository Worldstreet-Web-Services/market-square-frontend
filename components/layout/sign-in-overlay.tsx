"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SignInCard } from "@/features/profile";
import { useAuth } from "@/hooks/use-auth";
import {
  closeSignIn,
  getSignInOpen,
  getSignInOpenServer,
  subscribeSignIn,
} from "@/lib/signin-store";

/*
  THE SIGN-IN, AND NOTHING AFTER IT.

  This used to hold one more screen: a device that could hold a passkey was
  offered one here, on the way out, because every sign-in passed through. The
  wallet is now protected at the moment it is first USED instead (a tip, a
  gift, a purchase — see lib/wallet-protection), with the kit asking for no
  passkey or password at sign-in at all. So the overlay's job ends when the
  sign-in lands: it closes, and the reader is in.
*/
export function SignInOverlay() {
  const open = useSyncExternalStore(subscribeSignIn, getSignInOpen, getSignInOpenServer);
  const { authenticated } = useAuth();

  /*
    Signing in closes it. Not a `setState` in an effect — this writes to the
    module store, which is where the flag lives — but it does have to be an
    effect: without clearing the flag, signing out later would drop the reader
    straight back into a card they never asked for.
  */
  useEffect(() => {
    if (authenticated) closeSignIn();
  }, [authenticated]);

  if (!open || authenticated) return null;
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
