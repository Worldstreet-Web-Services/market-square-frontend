"use client";

import { DiscoveryPage, useMyInterests } from "@/features/discovery";
import { useStreamList } from "@/features/streams";

/**
 * Joins Explore's browse grid to the streams slice.
 *
 * The grid shows live streams filtered by the viewer's chosen topics, but
 * `useStreamList` belongs to the streams slice and slices never import each
 * other — so the two are wired here, the same way the timeline gets its follow
 * control and its live count.
 */
export function DiscoverScreen() {
  const interests = useMyInterests();
  const topics = interests.data?.topics ?? [];
  const live = useStreamList("live", topics);

  return <DiscoveryPage browseStreams={live.data?.items ?? []} />;
}
