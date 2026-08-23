"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useStreamList } from "@/features/streams/hooks/use-streams";
import { StreamCard } from "@/features/streams/components/stream-card";

function Section({
  title,
  status,
  empty,
}: {
  title: string;
  status: "live" | "scheduled" | "replay";
  empty: { title: string; body: string };
}) {
  const list = useStreamList(status);
  return (
    <section>
      <h2 className="ws-display mb-3 text-lg">{title}</h2>
      {list.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ws-card overflow-hidden">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}
      {list.isError && (
        <ErrorState error={list.error} fallback="Couldn't load streams." onRetry={() => list.refetch()} />
      )}
      {list.isSuccess && list.data.items.length === 0 && (
        <EmptyState glyph="◉" title={empty.title} body={empty.body} />
      )}
      {list.isSuccess && list.data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.data.items.map((stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      )}
    </section>
  );
}

export function LiveHub() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 lg:px-6">
      <Section
        title="Live now"
        status="live"
        empty={{ title: "No one is live", body: "Streams appear here the second they start." }}
      />
      <Section
        title="Upcoming"
        status="scheduled"
        empty={{ title: "Nothing scheduled", body: "Creators announce sessions here — follow a few to get notified." }}
      />
      <Section
        title="Replays"
        status="replay"
        empty={{ title: "No replays yet", body: "Ended streams with a replay land here." }}
      />
    </div>
  );
}
