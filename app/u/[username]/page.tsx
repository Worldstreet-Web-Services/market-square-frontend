import type { Metadata } from "next";
import { ProfilePage } from "@/features/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfilePage username={username} />;
}
