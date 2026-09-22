"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSocialAuth } from "decane-connect-kit";
import { DEMO_AUTH, LEGACY_PRIVY_APP_ID } from "@/lib/auth-mode";
import { useAuth } from "@/hooks/use-auth";
import {
  readCachedAccountState,
  recallSignInEmail,
  rememberSignInEmail,
  writeCachedAccountState,
  type AccountState,
} from "@/lib/account-state";
import { fetchAccountState } from "../lib/api";

export const ACCOUNT_STATE_KEY = ["ms", "migration", "account-state"] as const;

/** The gate's one question, and which sign-in it was asked for. */
export interface AccountStateAnswer {
  /** Undefined while on its way; the gate renders nothing of the app until then. */
  state: AccountState | undefined;
  /** Stable per sign-in — what the browser's memory is keyed on. */
  key: string | null;
  /** Linking exists in this deployment at all. */
  enabled: boolean;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Where this Decane sign-in stands relative to the old provider.
 *
 * Asked once per sign-in. The email comes from the provider at sign-in and
 * is kept per account (Decane stores no profile, so a reload has nothing
 * else to ask with). `linked` and `new` are kept too, so a returning reader
 * pays no round trip; `legacy` is asked again every load — it is the answer
 * that linking changes.
 */
export function useAccountState(): AccountStateAnswer {
  const { ready, authenticated } = useAuth();
  const { address, email } = useSignInIdentity();
  const enabled = !DEMO_AUTH && Boolean(LEGACY_PRIVY_APP_ID);
  const key = authenticated ? address : null;

  useEffect(() => {
    if (key) rememberSignInEmail(storage(), key, email);
  }, [key, email]);

  const cached = key ? readCachedAccountState(storage(), key) : undefined;
  const query = useQuery<AccountState>({
    queryKey: [...ACCOUNT_STATE_KEY, key],
    enabled: enabled && ready && authenticated && key !== null && cached === undefined,
    queryFn: async () => {
      const state = await fetchAccountState(email ?? recallSignInEmail(storage(), key!));
      writeCachedAccountState(storage(), key!, state);
      return state;
    },
    staleTime: Infinity,
    retry: false,
  });

  return { state: cached ?? query.data, key, enabled };
}

interface SignInIdentity {
  /** The EVM address, which is what `useAuth` treats as the signed-in identity. */
  address: string | null;
  /** Released by the provider at sign-in; gone after a reload. */
  email: string | undefined;
}

function useDecaneSignInIdentity(): SignInIdentity {
  const social = useSocialAuth();
  return { address: social.addresses?.evm ?? null, email: social.profile?.email };
}

// Demo mode mounts no Decane provider, so the kit's hook must not be called.
function useDemoSignInIdentity(): SignInIdentity {
  return { address: null, email: undefined };
}

const useSignInIdentity: () => SignInIdentity = DEMO_AUTH
  ? useDemoSignInIdentity
  : useDecaneSignInIdentity;
