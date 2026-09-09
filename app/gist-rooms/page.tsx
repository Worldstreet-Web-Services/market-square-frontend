import type { Metadata } from "next";
import { GistRoomsScreen } from "@/components/layout/gist-rooms-screen";

export const metadata: Metadata = { title: "Gist rooms" };

export default function Page() {
  return <GistRoomsScreen />;
}
