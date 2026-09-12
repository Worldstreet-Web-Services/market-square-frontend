import type { Metadata } from "next";
import { UnsubscribePage } from "@/features/settings";

export const metadata: Metadata = { title: "Email summaries" };

export default function Page() {
  return <UnsubscribePage />;
}
