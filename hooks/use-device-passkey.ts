"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocialWallet } from "decane-connect-kit";

/** Whether a passkey can be made here at all — no authenticator, nothing to offer. */
async function passkeysAvailable(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * "Add a passkey to this device", for a device that fell back to a PIN.
 *
 * A wallet made while no passkey was reachable — a password manager that was
 * not signed in, a dismissed prompt — wraps its share with a PIN, and the kit
 * never revisits that on its own: once a PIN-wrapped share exists, every
 * unlock goes to the PIN however available passkeys later become. This is what
 * lets the app revisit it.
 *
 * `addPasskey()` re-wraps the existing share under a fresh credential: one PIN
 * prompt, one passkey prompt, no re-auth. Older kits without it need a full
 * sign-out and sign-in to reach the same place, which is why that is reported
 * separately rather than done quietly.
 */
export function useDevicePasskey(): {
  /** Null until known. True when this device is on a PIN and could hold a passkey. */
  canAdd: boolean | null;
  /** True when the upgrade would need a full sign-out and sign-in. */
  needsReauth: boolean;
  adding: boolean;
  error: string | null;
  addPasskey: () => Promise<void>;
} {
  const wallet = useSocialWallet() as ReturnType<typeof useSocialWallet> & {
    hasPasskey?: () => Promise<boolean>;
    addPasskey?: () => Promise<void>;
  };
  const [canAdd, setCanAdd] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsDirect = typeof wallet.addPasskey === "function";

  useEffect(() => {
    let live = true;
    void (async () => {
      if (!wallet.isConnected) {
        if (live) setCanAdd(false);
        return;
      }
      if (!(await passkeysAvailable())) {
        if (live) setCanAdd(false);
        return;
      }
      // A kit that cannot report its wrapping gets the offer anyway: on a
      // device that already has a passkey the direct call is a no-op, which is
      // the cheaper mistake.
      if (!wallet.hasPasskey) {
        if (live) setCanAdd(true);
        return;
      }
      try {
        const has = await wallet.hasPasskey();
        if (live) setCanAdd(!has);
      } catch {
        if (live) setCanAdd(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [wallet, wallet.isConnected]);

  const addPasskey = useCallback(async () => {
    setError(null);
    setAdding(true);
    try {
      if (wallet.addPasskey) {
        await wallet.addPasskey();
        setCanAdd(false);
        return;
      }
      throw new Error("This build cannot add a passkey to an existing device.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not add a passkey. Please try again.");
      throw e;
    } finally {
      setAdding(false);
    }
  }, [wallet]);

  return { canAdd, needsReauth: !supportsDirect, adding, error, addPasskey };
}
