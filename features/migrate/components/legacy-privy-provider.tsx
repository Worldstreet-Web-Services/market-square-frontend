"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { LEGACY_PRIVY_APP_ID } from "@/lib/auth-mode";
import { asset } from "@/lib/square-path";

/**
 * Privy's last mount in Market Square.
 *
 * The app signs people in with Decane. This wraps ONE page — /move-account —
 * where a reader signs into their OLD account once, so it can be linked to the
 * new one and their profile moves across. Mounted on a route of its own rather
 * than a sheet, because Google and X sign-in leave the page and come back to
 * the SAME URL: the provider has to be there on the way back to finish the
 * sign-in and strip its credentials from the address bar.
 *
 * All three historical login methods stay on so every old account can get in.
 *
 * `createOnLogin: "off"`, per chain, is the part that matters. `showWalletUIs` only hides
 * the vendor's own dialogs; whether a wallet is MADE is this setting, and left
 * unset it falls back to whatever the old Privy app's dashboard says. Signing
 * in to READ an old account must never write to it, least of all by minting a
 * wallet on the account we are in the middle of migrating.
 *
 * This file goes away when the link window closes.
 */
export function LegacyPrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={LEGACY_PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "twitter", "email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
          showWalletUIs: false,
        },
        appearance: { theme: "#0c0c0e", accentColor: "#d4d4d8", logo: asset("/logo.svg") },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
