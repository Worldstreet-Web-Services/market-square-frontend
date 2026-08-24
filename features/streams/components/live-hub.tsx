"use client";

import { useState } from "react";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useStreamList } from "@/features/streams/hooks/use-streams";
import { StreamCard } from "@/features/streams/components/stream-card";

type Section = "live" | "scheduled" | "replay";

const TABS: Array<{ value: Section; label: string }> = [
  { value: "live", label: "Live now" },
  { value: "scheduled", label: "Upcoming" },
  { value: "replay", label: "Replays" },
];

const EMPTY: Record<Section, { title: string; body: string }> = {
  live: { title: "No one is live", body: "Streams appear here the second they start." },
  scheduled: {
    title: "Nothing scheduled",
    body: "Creators announce sessions here — follow a few to get notified.",
  },
  replay: { title: "No replays yet", body: "Ended streams with a replay land here." },
};

// The Live column. Three sections became three tabs: in a reading column the
// tab strip beats stacked sections, because "who is live" stays at the top.
export function LiveHub() {
  const [section, setSection] = useState<Section>("live");
  const list = useStreamList(section);
  const items = list.data?.items ?? [];

  return (
    <>
      <ColumnHeader title="Live" subtitle="Streams, sessions and replays on the square">
        <ColumnTabs tabs={TABS} value={section} onChange={setSection} />
      </ColumnHeader>

      {list.isPending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}

      {list.isError && (
        <div className="p-4">
          <ErrorState error={list.error} fallback="Couldn't load streams." onRetry={() => list.refetch()} />
        </div>
      )}

      {list.isSuccess && items.length === 0 && (
        <div className="p-4">
          <EmptyState glyph="◉" title={EMPTY[section].title} body={EMPTY[section].body} />
        </div>
      )}

      {items.map((stream) => (
        <StreamCard key={stream.id} stream={stream} />
      ))}
    </>
  );
}
