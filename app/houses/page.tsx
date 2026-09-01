import type { Metadata } from "next";
import { HousesStreet } from "@/features/houses";

export const metadata: Metadata = { title: "Houses" };

export default function Page() {
  return <HousesStreet />;
}
