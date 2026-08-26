"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { MARKET_FLAGS } from "@/lib/market-config";
import { useActivities, useStreamList } from "@/features/streams/hooks/use-streams";
import { StreamCard } from "@/features/streams/components/stream-card";
import { ActivityRow } from "@/features/streams/components/upcoming-activity-row";

type Section = "live" | "scheduled" | "replay";

// The Replays tab stays VISIBLE while the capability is off — it explains
// what the section will hold, which reads as a roadmap — but is disabled, so
// there is never a control that looks tappable and does nothing. See
// MARKET_FLAGS.replays for what has to be true upstream first.
const TABS: Array<{ value: Section; label: string; disabled?: boolean }> = [
  { value: "live", label: "Live now" },
  { value: "scheduled", label: "Upcoming" },
  { value: "replay", label: "Replays", disabled: !MARKET_FLAGS.replays },
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
    // Only reachable with the flag ON; with it off the tab cannot be selected.
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
  // Upcoming is BOTH scheduled streams and scheduled activities. It used to
  // read the stream list alone, so an activity — which is what the schedule
  // form creates — could never show up here no matter how many were made.
  const activityList = useActivities("scheduled");
  const items = list.data?.items ?? [];
  const activities = section === "scheduled" ? (activityList.data?.items ?? []) : [];

  // One chronological list, soonest first. A record with no start time sorts
  // last rather than being dropped — the backend currently returns scheduled
  // streams with a null scheduledAt, and hiding them would be worse than
  // showing them without a time.
  const upcoming = [
    ...items.map((stream) => ({
      key: `s:${stream.id}`,
      at: stream.scheduledAt ? Date.parse(stream.scheduledAt) : Number.POSITIVE_INFINITY,
      node: <StreamCard key={`s:${stream.id}`} stream={stream} />,
    })),
    ...activities.map((activity) => ({
      key: `a:${activity.id}`,
      at: activity.startsAt ? Date.parse(activity.startsAt) : Number.POSITIVE_INFINITY,
      node: <ActivityRow key={`a:${activity.id}`} activity={activity} />,
    })),
  ].sort((a, b) => a.at - b.at);

  const pending = list.isPending || (section === "scheduled" && activityList.isPending);
  const failed = list.isError && (section !== "scheduled" || activityList.isError);
  const isEmpty =
    section === "scheduled" ? upcoming.length === 0 : items.length === 0;

  return (
    <>
      <ColumnHeader title="Live" subtitle="Streams and sessions on the square">
        <ColumnTabs tabs={TABS} value={section} onChange={setSection} />
      </ColumnHeader>

      {pending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}

      {failed && (
        <div className="p-4">
          <ErrorState
            error={list.error ?? activityList.error}
            fallback="Couldn't load what's coming up."
            onRetry={() => {
              void list.refetch();
              void activityList.refetch();
            }}
          />
        </div>
      )}

      {!pending && !failed && isEmpty && (
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

      {section === "scheduled"
        ? upcoming.map((entry) => entry.node)
        : items.map((stream) => <StreamCard key={stream.id} stream={stream} />)}
    </>
  );
}
