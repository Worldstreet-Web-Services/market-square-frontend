import type { Metadata } from "next";
import { StoreItemPage } from "@/features/store";

export const metadata: Metadata = { title: "Store item" };

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StoreItemPage slug={slug} />;
}
