import type { Metadata } from "next";
import { LiveHub } from "@/features/streams";

export const metadata: Metadata = { title: "Live" };

export default function Page() {
  return <LiveHub />;
}
