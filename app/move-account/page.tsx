import type { Metadata } from "next";
import { MoveAccountPage } from "@/features/migrate";

export const metadata: Metadata = { title: "Upgrade your account" };

export default function Page() {
  return <MoveAccountPage />;
}
