"use client";

import { useRouter } from "next/navigation";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { useAuth } from "@/hooks/use-auth";
import { useMe } from "@/hooks/use-me";
import { Button, Spinner } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";

export function AuthPage() {
  const { ready, authenticated, login, logout } = useAuth();
  const me = useMe();
  const router = useRouter();
  const profile = me.data ?? null;

  return (
    <div className="flex min-h-[80dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-7 text-center">
        <div>
          <span className="ws-display mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-xl text-ink">
            M
          </span>
          <h1 className="ws-display text-3xl tracking-tight">
            Market <span className="text-accent">Square</span>
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

        {ready && !authenticated && (
          <>
            <Button size="lg" className="w-full" onClick={login}>
              Continue with Privy
            </Button>
            <p className="text-[13px] text-meta">Google, Twitter, or email — one tap, no seed phrases.</p>
          </>
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
              <Button className="w-full" onClick={() => router.push("/")}>
                Go to the square
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
