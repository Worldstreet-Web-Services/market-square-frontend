import type { Metadata } from "next";
import { HouseProfileScreen } from "@/components/layout/house-profile-screen";

export const metadata: Metadata = { title: "House" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HouseProfileScreen id={id} />;
}
