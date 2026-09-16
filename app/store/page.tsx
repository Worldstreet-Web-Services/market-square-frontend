import type { Metadata } from "next";
import { StorePage } from "@/features/store";

export const metadata: Metadata = { title: "ARK Store" };

export default function Page() {
  return <StorePage />;
}
