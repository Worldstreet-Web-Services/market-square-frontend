"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-me";
import { ClaimUsernameSheet } from "@/features/profile/components/edit-profile-sheet";
import { sq } from "@/lib/square-path";

// Mounted once in the shell: the moment /me arrives after login with no
// chosen username, the claim sheet opens prominently — on any page, not
// hidden behind the edit flow. Dismissal is remembered for the session so it
// doesn't nag on every navigation; a successful claim routes straight to the
// new profile.
const DISMISS_KEY = "msq-claim-dismissed";

export function ClaimUsernameGate() {
  const me = useMe();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  const profile = me.data ?? null;
  if (!profile || !profile.usernameUnclaimed || dismissed) return null;

  return (
    <ClaimUsernameSheet
      me={profile}
      open
      onClose={() => {
        setDismissed(true);
        window.sessionStorage.setItem(DISMISS_KEY, "1");
      }}
      onClaimed={(username) => router.push(sq(`/u/${username}`))}
    />
  );
}
