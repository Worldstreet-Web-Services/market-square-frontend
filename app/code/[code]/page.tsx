import type { Metadata } from "next";
import { RoomCodeScreen } from "@/components/layout/room-code-screen";

export const metadata: Metadata = { title: "Join with a code" };

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomCodeScreen code={decodeURIComponent(code)} />;
}
