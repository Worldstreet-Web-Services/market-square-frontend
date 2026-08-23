import type { Metadata } from "next";
import { AuthPage } from "@/features/profile";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <AuthPage />;
}
