"use client";

import { useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { createQueryClient } from "@/lib/query-client";
import { DEMO_AUTH } from "@/lib/auth-mode";
import { asset } from "@/lib/square-path";
import { privyAppId } from "@/lib/privy-app-id";

/*
  A WELL-FORMED ID, WHATEVER THE ENVIRONMENT SAYS.

  `PrivyProvider` throws on a malformed id rather than degrading, and it wraps
  the whole tree — so the throw lands while Next prerenders and fails the
  BUILD. This used to fall back only on an EMPTY value, which let CI's
  deliberate `ci-placeholder` through and broke every gates run on every
  branch. `privyAppId` checks the shape instead. In demo mode Privy is mounted
  but never used (useAuth short-circuits).
*/
const PRIVY_APP_ID = privyAppId(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

function AuthProvider({ children }: { children: React.ReactNode }) {
  if (DEMO_AUTH) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "twitter", "email"],
        /**
         * The embedded wallet, configured the same way wsws configures it.
         *
         * Both apps run on ONE Privy app id, so a reader who has signed into
         * either already has this wallet and Market Square simply reads it —
         * which is what makes a balance earned over there spendable here. What
         * this block fixes is the reader who only ever signs in HERE: relying
         * on the dashboard's own create-on-login setting means Market Square's
         * behaviour is defined somewhere this repo cannot see, and a money
         * surface that silently does nothing for a whole class of user is the
         * worst way to find that out. Stated here, both apps mint the same
         * wallet on the same terms, and if the dashboard already does it this
         * is a no-op.
         *
         * `showWalletUIs: false` is not cosmetic and is also wsws's setting.
         * A sponsored purchase is TWO wallet interactions — the one-time 7702
         * delegation signature and the userOperation — and a modal in front of
         * each turns one deliberate act into a sequence the reader has to
         * decode. The confirmation lives in our own sheet instead, which names
         * the amount, the price, the fee, where the token lands and that it
         * cannot be reversed, and the button is the last step. That is the
         * trade being made: the app owns the confirmation, so the app has to
         * be the one that tells the truth before it.
         */
        embeddedWallets: {
          showWalletUIs: false,
          ethereum: { createOnLogin: "users-without-wallets" },
          // Solana is minted too, matching wsws exactly, so one identity is
          // one identity across both products. Nothing here spends it —
          // `lib/buy-routes.ts` refuses Solana destinations, because Market
          // Square has no Solana send path to deliver with.
          solana: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "#0c0c0e",
          accentColor: "#d4d4d8",
          // One brand asset everywhere, including the Privy dialog.
          logo: asset("/logo.svg"),
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#0c0c0e",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
            },
          }}
        />
      </QueryClientProvider>
    </AuthProvider>
  );
}
