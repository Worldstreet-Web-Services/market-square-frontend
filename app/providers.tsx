"use client";

import { useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { createQueryClient } from "@/lib/query-client";
import { DEMO_AUTH } from "@/lib/auth-mode";

// Well-formed placeholder lets the app build before env vars are set; in demo
// mode Privy is mounted but never used (useAuth short-circuits).
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cl0123456789abcdefghijklm";

function AuthProvider({ children }: { children: React.ReactNode }) {
  if (DEMO_AUTH) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "twitter", "email"],
        appearance: {
          theme: "#0c0c0e",
          accentColor: "#d4d4d8",
          // One brand asset everywhere, including the Privy dialog.
          logo: "/logo.svg",
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
