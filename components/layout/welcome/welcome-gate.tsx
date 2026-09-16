"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SignInCard } from "@/features/profile";
import { useAuth } from "@/hooks/use-auth";
import { useQueryParam } from "@/hooks/use-query-param";
import {
  WelcomeFlow,
  useShowWelcome,
} from "@/components/layout/welcome/welcome-flow";
import { sq } from "@/lib/square-path";

/**
 * WHAT A NEWCOMER SEES AFTER THE SPLASH.
 *
 * Splash -> Desktop 35 -> 33 -> 36 -> 34 -> the sign-in card, then the app.
 *
 * It composes across slices — the welcome screens are layout, the sign-in card
 * belongs to `features/profile`, which owns identity — so it lives here, the
 * same route-slot pattern `home-screen` and `messages-screen` use. Slices never
 * import each other.
 *
 * ─── IT IS AN OVERLAY, NOT A ROUTE ──────────────────────────────────────────
 * A `/welcome` route would need a redirect on every entry point and would put
 * a history entry between the reader and the app; worse, it would have to
 * redirect BACK, and a redirect that fires on a signed-out visitor is exactly
 * how a shared link stops working. As an overlay the app underneath is already
 * mounted, already fetching, and already correct — dismissing costs nothing and
 * navigates nowhere.
 *
 * The `z-[90]` sits under the splash's `z-[100]`, deliberately: on a cold boot
 * both are mounted for a moment and the splash is the one that should be on
 * top. It scrolls, because on a short window the card plus its lockup is taller
 * than the viewport and a sign-in button you cannot reach is not a sign-in.
 *
 * ─── THERE IS ALWAYS A WAY PAST IT ──────────────────────────────────────────
 * Signed-out browsing is a real, supported thing here — Explore, feeds,
 * profiles, posts and streams are all public GETs, and the sign-in prompt is
 * meant to appear at the moment somebody does something that needs an account.
 * So the last screen carries a quiet way into the app without an account.
 *
 * The file does not draw one. It is added because the alternative is a
 * dead end: the sequence ends on a card offering Google and email and nothing
 * else, and a reader who wants neither has no way forward at all. Every other
 * exit is a page reload, which is not an exit.
 */
export function WelcomeGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, authenticated } = useAuth();
  // `returnTo` is how an expired session is told apart from a newcomer — see
  // `isWelcomeSurface`. Read with `useQueryParam`, never `useSearchParams`:
  // that one forces a Suspense boundary which delays hydration of this subtree.
  const returnTo = useQueryParam("returnTo");
  const { show, dismiss } = useShowWelcome(pathname, returnTo, authenticated, ready);
  const [signIn, setSignIn] = useState(false);

  /**
   * "Look around first" has to LAND somewhere, and the sign-in page is not it.
   *
   * The sequence can be running over `/auth` as well as over `/`, so simply
   * hiding the overlay left the reader looking at the sign-in card they had
   * just declined — the same screen, minus the way out. Dismissing from there
   * takes them to the front door.
   *
   * `replace`, not `push`: /auth is not a step anybody wants to come back to
   * with the back button, and the welcome will not show again anyway.
   */
  const lookAround = () => {
    dismiss();
    if (pathname === "/auth") router.replace(returnTo ?? sq("/"));
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-[#0F0F0F]">
      {signIn ? (
        <SignInCard onSkip={lookAround} />
      ) : (
        <WelcomeFlow onDone={() => setSignIn(true)} />
      )}
    </div>
  );
}
