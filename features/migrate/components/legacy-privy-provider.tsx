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
 * No wallets are created: an account that never had one has nothing to bring.
 * This file goes away when the link window closes.
 */
export function LegacyPrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={LEGACY_PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "twitter", "email"],
        embeddedWallets: { showWalletUIs: false },
        appearance: { theme: "#0c0c0e", accentColor: "#d4d4d8", logo: asset("/logo.svg") },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
