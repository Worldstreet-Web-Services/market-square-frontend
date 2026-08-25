import type { Metadata } from "next";
import { PostScreen } from "@/components/layout/home-screen";

export const metadata: Metadata = { title: "Post" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostScreen postId={id} />;
}
