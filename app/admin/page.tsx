import type { Metadata } from "next";
import { AdminPage } from "@/features/admin";

export const metadata: Metadata = { title: "Admin" };

export default function Page() {
  return <AdminPage />;
}
