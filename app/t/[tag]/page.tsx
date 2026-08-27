import { DiscussionScreen } from "@/components/layout/discussion-screen";

export default async function DiscussionPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  return <DiscussionScreen tag={decodeURIComponent(tag).toLowerCase()} />;
}
