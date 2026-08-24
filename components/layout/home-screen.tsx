"use client";

import { FeedPage, ArkmarksPage } from "@/features/feed";
import { FollowPill } from "@/features/profile";
import { useStreamList } from "@/features/streams";

// Slices never import each other, so the follow control — which belongs to the
// profile slice — is composed into the timeline here, the same way the stream
// room gets its own. Both home surfaces share the one slot.
const followSlot = (author: Parameters<typeof FollowPill>[0]["profile"]) => (
  <FollowPill profile={author} />
);

export function HomeScreen() {
  // The mobile lane badge counts what is actually live — the streams slice
  // owns that list, so the count is composed in here too.
  const live = useStreamList("live");
  return <FeedPage followSlot={followSlot} liveCount={live.data?.items.length} />;
}

export function ArkmarksScreen() {
  return <ArkmarksPage followSlot={followSlot} />;
}
