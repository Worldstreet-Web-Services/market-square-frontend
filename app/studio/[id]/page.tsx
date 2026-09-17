import type { Metadata } from "next";
import { StudioRoomScreen } from "@/components/layout/studio-room-screen";

export const metadata: Metadata = { title: "Studio" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudioRoomScreen streamId={id} />;
}
