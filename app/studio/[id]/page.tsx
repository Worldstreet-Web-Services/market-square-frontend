import type { Metadata } from "next";
import { StudioStreamScreen } from "@/features/streams";

export const metadata: Metadata = { title: "Studio" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudioStreamScreen streamId={id} />;
}
