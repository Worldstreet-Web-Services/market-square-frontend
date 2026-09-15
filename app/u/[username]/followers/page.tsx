import type { Metadata } from "next";
import { FollowListPage } from "@/features/profile";

export const metadata: Metadata = { title: "Followers" };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <FollowListPage username={username} tab="followers" />;
}
