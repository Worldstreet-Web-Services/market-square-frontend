import type { Metadata } from "next";
import { SpotlightPage } from "@/features/profile";

export const metadata: Metadata = { title: "Spotlight" };

export default function Page() {
  return <SpotlightPage />;
}
