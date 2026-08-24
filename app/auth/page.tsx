import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthPage } from "@/features/profile";

export const metadata: Metadata = { title: "Sign in" };

// Suspense boundary: AuthPage reads searchParams (returnTo) on the client.
export default function Page() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  );
}
