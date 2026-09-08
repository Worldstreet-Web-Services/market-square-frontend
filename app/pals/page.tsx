import type { Metadata } from "next";
import { PalsScreen } from "@/components/layout/pals-screen";

export const metadata: Metadata = { title: "Pals" };

export default function Page() {
  return <PalsScreen />;
}
