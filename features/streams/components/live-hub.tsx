"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { IconSearch } from "@/components/ui/icons";
import { MARKET_FLAGS } from "@/lib/market-config";
import { useActivities, useStreamList } from "@/features/streams/hooks/use-streams";
import { StreamCard } from "@/features/streams/components/stream-card";
import { LiveHero } from "@/features/streams/components/live-hero";
import { LiveRail } from "@/features/streams/components/live-rail";
import { ActivityRow } from "@/features/streams/components/upcoming-activity-row";
import type { Stream } from "@/features/streams/lib/types";

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

// Rail headings for the categories the service actually issues. The design
// draws "Trading" and "Religion", which are examples of this same shape — the
// labels come from the live catalogue rather than being hard-coded to a demo,
// and a category with nothing in it never renders a heading.
const CATEGORY_LABELS: Record<string, string> = {
  worldstreet: "WorldStreet",
  music: "Music",
  podcast: "Podcasts",
  gaming: "Gaming",
  other: "Everything else",
};

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

/**
 * Groups live rooms into rails, biggest category first.
 *
 * Ordering by size rather than alphabetically keeps the busiest part of the
 * square at the top, which is what somebody scanning for a room to enter is
 * looking for.
 */
function railsFor(streams: Stream[]): Array<{ key: string; title: string; streams: Stream[] }> {
  const grouped = new Map<string, Stream[]>();
  for (const stream of streams) {
    const key = stream.category || "other";
    const bucket = grouped.get(key);
    if (bucket) bucket.push(stream);
    else grouped.set(key, [stream]);
  }
  return [...grouped.entries()]
    .map(([key, group]) => ({
      key,
      // An unrecognised category still gets a rail under its own name rather
      // than being swallowed into "other": the service can add categories
      // without a frontend release.
      title: CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
      streams: group,
    }))
    .sort((a, b) => b.streams.length - a.streams.length);
}

// The Live column. Three sections became three tabs: in a reading column the
// tab strip beats stacked sections, because "who is live" stays at the top.
export function LiveHub() {
  const [section, setSection] = useState<Section>("live");
  const [query, setQuery] = useState("");
  const { authenticated } = useAuth();
  const list = useStreamList(section);
  // Upcoming is BOTH scheduled streams and scheduled activities. It used to
  // read the stream list alone, so an activity — which is what the schedule
  // form creates — could never show up here no matter how many were made.
  const activityList = useActivities("scheduled");
  // Memoised because a fresh [] each render would re-run every downstream
  // useMemo — including the grouping — on every keystroke in the search field.
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const activities = section === "scheduled" ? (activityList.data?.items ?? []) : [];

  // Filtering happens over the loaded page, so the field narrows what is on
  // screen instantly and never blanks the page waiting on a request. Title and
  // handle both, because people search for a host as often as for a topic.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((stream) => {
      const haystack = `${stream.title} ${stream.owner?.username ?? ""} ${stream.owner?.displayName ?? ""}`;
      return haystack.toLowerCase().includes(needle);
    });
  }, [items, query]);

  const rails = useMemo(() => railsFor(visible), [visible]);

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
  const isEmpty = section === "scheduled" ? upcoming.length === 0 : items.length === 0;
  // A search that matches nothing is NOT the same as an empty square, and
  // telling somebody "nobody is live" while three rooms are running would be
  // simply wrong.
  const noMatches = section === "live" && !isEmpty && visible.length === 0;

  return (
    <>
      <ColumnHeader title="Live" subtitle="Streams and sessions on the square">
        <ColumnTabs tabs={TABS} value={section} onChange={setSection} />
      </ColumnHeader>

      {section === "live" && (
        <div className="px-4 pb-4 pt-3 lg:px-6">
          <label className="flex h-[52px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 transition-colors focus-within:border-white/25">
            <IconSearch className="h-4 w-4 shrink-0 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search live feeds..."
              aria-label="Search live feeds"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-muted"
            />
          </label>
        </div>
      )}

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

      {noMatches && (
        <div className="p-4">
          <EmptyState
            glyph="◉"
            title={`No live feeds match "${query.trim()}"`}
            body="Try a host's handle, or clear the search to see everything that's live."
          />
        </div>
      )}

      {section === "live" && !pending && !failed && visible.length > 0 && (
        <div className="space-y-8 pb-6">
          <LiveHero streams={visible} />

          {/* The go-live prompt sits between the hero and the rails: after the
              proof that people are streaming, before the browse that would
              carry somebody off the page. Signed-out readers do not see it —
              "Stream now" that opens a login wall is a bait. */}
          {authenticated && (
            <div className="px-4 lg:px-6">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
                <p className="min-w-0 text-[14px] font-semibold leading-tight text-white">
                  Build your audience live
                </p>
                <Link
                  href="/studio"
                  className="ws-press shrink-0 rounded-full bg-white px-4 py-1.5 text-[12px] font-bold text-black transition-opacity hover:opacity-90"
                >
                  Stream now
                </Link>
              </div>
            </div>
          )}

          <LiveRail title="Recommended live streams" streams={visible} />

          {/* A single category means the rail would repeat "Recommended" under
              a different heading, so the per-category rails only appear once
              there is more than one category live. */}
          {rails.length > 1 &&
            rails.map((rail) => (
              <LiveRail key={rail.key} title={rail.title} streams={rail.streams} />
            ))}
        </div>
      )}

      {section === "scheduled" && upcoming.map((entry) => entry.node)}

      {section === "replay" && items.map((stream) => <StreamCard key={stream.id} stream={stream} />)}
    </>
  );
}
