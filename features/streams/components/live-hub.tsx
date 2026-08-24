"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
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

// Each empty section explains itself and offers the action that fills it.
// `authed` actions are hidden from signed-out readers rather than walling them.
interface SectionEmpty {
  title: string;
  body: string;
  cta: { label: string; href: string; authed?: boolean };
}

const EMPTY: Record<Section, SectionEmpty> = {
  live: {
    title: "Nobody's live right now",
    body: "Streams appear here the second they start.",
    cta: { label: "Go live", href: "/studio", authed: true },
  },
  scheduled: {
    title: "Nothing scheduled",
    body: "Creators announce sessions ahead of time here.",
    cta: { label: "Schedule a stream", href: "/schedule", authed: true },
  },
  replay: {
    title: "No replays yet",
    body: "Ended streams with a replay saved land here.",
    cta: { label: "Find creators to follow", href: "/spotlight" },
  },
};

// The Live column. Three sections became three tabs: in a reading column the
// tab strip beats stacked sections, because "who is live" stays at the top.
export function LiveHub() {
  const [section, setSection] = useState<Section>("live");
  const { authenticated } = useAuth();
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
          <EmptyState
            glyph="◉"
            title={EMPTY[section].title}
            body={EMPTY[section].body}
            action={
              !EMPTY[section].cta.authed || authenticated ? (
                <Link
                  href={EMPTY[section].cta.href}
                  className="ws-press inline-flex rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
                >
                  {EMPTY[section].cta.label}
                </Link>
              ) : undefined
            }
          />
        </div>
      )}

      {items.map((stream) => (
        <StreamCard key={stream.id} stream={stream} />
      ))}
    </>
  );
}
