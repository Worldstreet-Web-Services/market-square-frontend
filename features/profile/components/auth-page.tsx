"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { Button, Spinner } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";
import { Wordmark } from "@/components/ui/wordmark";
import { SignInCard } from "./sign-in-card";

export function AuthPage() {
  const { ready, authenticated, logout } = useAuth();
  const me = useMe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = me.data ?? null;
  // Where an expired session should land the user again after signing in.
  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = rawReturnTo?.startsWith("/") ? rawReturnTo : null;

  /* Signed out, this route IS the design's sign-in card (Desktop 40) — the
     same one the welcome sequence ends on, so an expired session and a first
     visit land on one surface rather than two that drift. The column below is
     only ever the SIGNED-IN state: where to go next, and how to sign out. */
  if (ready && !authenticated) return <SignInCard />;

  return (
    <div className="flex min-h-[80dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-7 text-center">
        <div>
          {/* The wordmark is the identity here — the monogram alongside it
              would be the same name twice. */}
          <h1 className="flex justify-center">
            <Wordmark height={52} />
            <span className="sr-only">Market Square</span>
          </h1>
          <p className="mt-2 text-[15px] leading-normal text-meta">
            The social square of the Ark platform. Streams, the ARK Store, creators and community — one account.
          </p>
        </div>

        {!ready && (
          <div className="flex justify-center py-4">
            <Spinner className="h-6 w-6 text-grey-500" />
          </div>
        )}

        {ready && authenticated && (
          <div className="space-y-4">
            {DEMO_AUTH && <Pill>Demo session</Pill>}
            <p className="text-sm text-grey-300">
              {profile ? (
                <>
                  Signed in as <span className="font-semibold text-white">@{profile.username}</span>
                </>
              ) : (
                "Setting up your profile…"
              )}
            </p>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => router.push(returnTo ?? "/")}>
                {returnTo ? "Continue where you left off" : "Go to the square"}
              </Button>
              {profile && (
                <Button variant="secondary" className="w-full" onClick={() => router.push(`/u/${profile.username}`)}>
                  My profile
                </Button>
              )}
              {!DEMO_AUTH && (
                <Button variant="ghost" className="w-full" onClick={() => void logout()}>
                  Sign out
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
