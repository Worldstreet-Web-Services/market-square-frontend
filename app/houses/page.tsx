import type { Metadata } from "next";
import { HousesScreen } from "@/components/layout/houses-screen";

export const metadata: Metadata = { title: "Houses" };

export default function Page() {
  return <HousesScreen />;
}
