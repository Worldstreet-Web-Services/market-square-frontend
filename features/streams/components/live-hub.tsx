"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { ColumnHeader, ColumnTabs } from "@/components/layout/column-header";
import { RowSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { MARKET_FLAGS } from "@/lib/market-config";
import { useActivities, useStreamList } from "@/features/streams/hooks/use-streams";
import { StreamCard } from "@/features/streams/components/stream-card";
import { LiveHero } from "@/features/streams/components/live-hero";
import { LiveCta } from "@/features/streams/components/live-cta";
import { LiveSection } from "@/features/streams/components/live-section";
import { IconSearchLive } from "@/features/streams/components/live-icons";
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

// Headings for the categories the service issues. The design draws "Trading"
// and "Religion" as examples of this same shape; the labels come from what is
// actually live rather than being hard-coded to the mock, so a category the
// backend adds appears without a frontend release.
const CATEGORY_LABELS: Record<string, string> = {
  worldstreet: "WorldStreet",
  music: "Music",
  podcast: "Podcasts",
  gaming: "Gaming",
  other: "Everything else",
};

const label = (key: string) => CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);

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

/** Groups live rooms by category, busiest first — what a scan wants at the top. */
function groupByCategory(streams: Stream[]): Array<{ key: string; streams: Stream[] }> {
  const grouped = new Map<string, Stream[]>();
  for (const stream of streams) {
    const key = stream.category || "other";
    const bucket = grouped.get(key);
    if (bucket) bucket.push(stream);
    else grouped.set(key, [stream]);
  }
  return [...grouped.entries()]
    .map(([key, group]) => ({ key, streams: group }))
    .sort((a, b) => b.streams.length - a.streams.length);
}

// The Live column. Three sections became three tabs: in a reading column the
// tab strip beats stacked sections, because "who is live" stays at the top.
export function LiveHub() {
  const [section, setSection] = useState<Section>("live");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
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

  // Chips come from the categories that are actually live. The design's fixed
  // list would ship chips that can only ever return nothing, and a chip that
  // always lands on an empty page is worse than no chip.
  const topics = useMemo(
    () => groupByCategory(items).map((group) => group.key),
    [items]
  );

  // Filtering happens over the loaded page, so both the field and the chips
  // narrow what is on screen instantly and never blank the page on a request.
  // Title and handle both, because people search for a host as often as for a
  // topic.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((stream) => {
      if (topic && (stream.category || "other") !== topic) return false;
      if (!needle) return true;
      const haystack = `${stream.title} ${stream.owner?.username ?? ""} ${stream.owner?.displayName ?? ""}`;
      return haystack.toLowerCase().includes(needle);
    });
  }, [items, query, topic]);

  const groups = useMemo(() => groupByCategory(visible), [visible]);

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
  // A filter that matches nothing is NOT the same as an empty square, and
  // telling somebody "nobody is live" while rooms are running would be wrong.
  const noMatches = section === "live" && !isEmpty && visible.length === 0;

  return (
    <>
      {/* Title hidden: the breadcrumb above reads "Ark Ecosystem / Live" and
          the sidebar marks Live as the current section, so drawing it a third
          time spends a band of vertical space to say nothing new. */}
      <ColumnHeader title="Live" hideTitle>
        <ColumnTabs tabs={TABS} value={section} onChange={setSection} />
      </ColumnHeader>

      {section === "live" && (
        <>
          {/* 709x52, fully rounded, hairline white-40 border, 16px/500
              placeholder in #7a7a7a — the measured field. */}
          <div className="px-4 pt-4 lg:px-6">
            <label className="flex h-[52px] items-center gap-[11px] rounded-full border-[0.68px] border-white/40 px-3 transition-colors focus-within:border-white">
              <IconSearchLive className="h-4 w-4 shrink-0 text-[#6d6d6d]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search live feeds..."
                aria-label="Search live feeds"
                className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-[22px] tracking-[-0.112px] text-white outline-none placeholder:text-[#7a7a7a]"
              />
            </label>
          </div>

          {topics.length > 1 && (
            <div className="flex gap-1 overflow-x-auto px-4 pt-7 [scrollbar-width:none] lg:px-6 [&::-webkit-scrollbar]:hidden">
              {[null, ...topics].map((value) => {
                const selected = topic === value;
                return (
                  <button
                    key={value ?? "for-you"}
                    type="button"
                    onClick={() => setTopic(value)}
                    aria-pressed={selected}
                    className={cn(
                      "ws-press flex h-[38px] shrink-0 items-center justify-center rounded-full px-[10px] text-[12px] font-bold leading-4 transition-colors",
                      selected
                        ? "bg-[linear-gradient(90deg,#ffffff_0%,#999999_100%)] text-[#0a0a0a]"
                        : "text-white/40 hover:text-white/70"
                    )}
                  >
                    {value === null ? "For you" : label(value)}
                  </button>
                );
              })}
            </div>
          )}
        </>
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
            title="Nothing matches that yet"
            body="Try a host's handle, or clear the search to see everything that's live."
          />
        </div>
      )}

      {section === "live" && !pending && !failed && visible.length > 0 && (
        <>
          {/* One gap owns the rhythm between the chrome, the banner and the
              hero — the design spaces these ~28px apart, and per-block padding
              collapsed to 11px whenever the chip row did not render. */}
          <div className="space-y-7 pt-7">
            {/* Signed-out readers do not see the prompt — "Go Live" that opens
                a login wall is bait. */}
            {authenticated && <LiveCta />}

            <LiveHero streams={visible} />
          </div>

          <LiveSection
            title="Recommended live streams"
            streams={visible}
            viewAllHref="/explore?tab=live"
          />

          {/* Per-category sections only once there is more than one category
              live — otherwise the section repeats "Recommended" verbatim. */}
          {groups.length > 1 &&
            groups.map((group) => (
              <LiveSection
                key={group.key}
                title={label(group.key)}
                streams={group.streams}
                viewAllHref={`/explore?tab=live&topic=${encodeURIComponent(group.key)}`}
              />
            ))}
        </>
      )}

      {section === "scheduled" && upcoming.map((entry) => entry.node)}

      {section === "replay" && items.map((stream) => <StreamCard key={stream.id} stream={stream} />)}
    </>
  );
}
