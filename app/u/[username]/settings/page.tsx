import type { Metadata } from "next";
import { SettingsScreen } from "@/components/layout/settings-screen";

export const metadata: Metadata = { title: "Settings" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <SettingsScreen username={username} />;
}
