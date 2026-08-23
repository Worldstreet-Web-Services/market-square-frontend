import type { Metadata } from "next";
import { StreamRoomScreen } from "@/components/layout/stream-room-screen";

export const metadata: Metadata = { title: "Stream" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StreamRoomScreen streamId={id} />;
}
