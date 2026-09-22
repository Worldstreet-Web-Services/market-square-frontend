import type { Metadata } from "next";
import { HouseRoomScreen } from "@/components/layout/house-room-screen";

export const metadata: Metadata = { title: "House" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HouseRoomScreen houseId={id} />;
}
