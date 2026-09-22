"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/button";
import { SquareLockup } from "@/components/ui/square-mark";
import { useAuth } from "@/hooks/use-auth";
import { gateDecision, recordUpgradeDeclined, upgradeDeclined } from "@/lib/account-state";
import { ACCOUNT_STATE_KEY, useAccountState } from "@/features/migrate/hooks/use-account-state";
import { MoveAccountPage } from "@/features/migrate/components/move-account-page";

/**
 * THE UPGRADE COMES BEFORE THE APP.
 *
 * A Decane sign-in whose old Square profile is still keyed to a Privy DID
 * makes an EMPTY profile under the new id on its first authenticated call,
 * and the moment anything touches that profile the re-key refuses for good:
 * the person is two accounts and a human has to merge them. Seen live three
 * minutes after a sign-in — the shell picked up a settings row and a
 * presence write before the link arrived.
 *
 * So nothing that talks to Square renders until the service has said where
 * this sign-in stands. `legacy` gets the upgrade flow — sign in to the old
 * account, link, continue — on the very screen it would otherwise have
 * entered the app from. `new`, `linked` and `unknown` go straight through:
 * an outage must not lock anybody out, and the manual door stays for that.
 *
 * Wraps EVERYTHING under the providers, not only the shell: the welcome and
 * sign-in surfaces are harmless, but the rule "no Square call before the
 * answer" is easier to keep than to audit.
 */
export function MigrationGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = useAuth();
  const { state, key, enabled } = useAccountState();
  const queryClient = useQueryClient();
  // Read once per sign-in; the button below is the only thing that sets it.
  const [declined, setDeclined] = useState<string | null>(null);
  const dismissed = key !== null && (declined === key || upgradeDeclined(safeStorage(), key));

  const decision = gateDecision({ enabled, ready, authenticated, state, dismissed });
  if (decision === "app") return <>{children}</>;

  if (decision === "checking") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#0F0F0F] px-4">
        <SquareLockup className="[--lockup-mark:80px]" />
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-grey-500" />
          <p role="status" className="text-[15px] text-[#999999]">
            Signing you in…
          </p>
        </div>
      </div>
    );
  }

  const continueAsNew = () => {
    if (!key) return;
    recordUpgradeDeclined(safeStorage(), key);
    setDeclined(key);
    void queryClient.invalidateQueries({ queryKey: [...ACCOUNT_STATE_KEY] });
  };

  return (
    <div className="min-h-dvh bg-[#0F0F0F]">
      <MoveAccountPage />
      {/*
        The way past, for the one case the email got wrong: a shared address,
        or an old account this person genuinely cannot sign into. Quiet on
        purpose — the default is the upgrade — and remembered, because being
        asked again on every reload is nagging. It is a real choice: an old
        account can be brought across later only while nothing has touched
        the new one.
      */}
      <p className="pb-10 text-center">
        <button
          type="button"
          onClick={continueAsNew}
          className="text-[14px] text-[#999999] underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          This isn&apos;t my old account — continue as new
        </button>
      </p>
    </div>
  );
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
