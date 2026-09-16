import type { Metadata } from "next";
import { SchedulePage } from "@/features/streams";

export const metadata: Metadata = { title: "Schedule" };

export default function Page() {
  return <SchedulePage />;
}
