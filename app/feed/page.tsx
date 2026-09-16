import type { Metadata } from "next";
import { FeedScreen } from "@/components/layout/feed-screen";

export const metadata: Metadata = { title: "Posts" };

export default function Page() {
  return <FeedScreen />;
}
