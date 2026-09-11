import type { Metadata } from "next";
import { JoinPage } from "@/features/messages";

export const metadata: Metadata = { title: "Join a house" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinPage token={decodeURIComponent(token)} />;
}
