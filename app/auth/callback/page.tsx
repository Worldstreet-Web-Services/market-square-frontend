import type { Metadata } from "next";
import { AuthCallbackPage } from "@/features/profile";

export const metadata: Metadata = { title: "Signing you in" };

export default function Page() {
  return <AuthCallbackPage />;
}
