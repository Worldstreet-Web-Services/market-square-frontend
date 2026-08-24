import type { Metadata } from "next";
import { ProfileScreen } from "@/components/layout/profile-screen";

export const metadata: Metadata = { title: "Profile" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfileScreen username={username} />;
}
