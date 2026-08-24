"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { IconCalendar, IconChevronDown, IconPlus } from "@/components/ui/icons";
import { useQueryParam } from "@/hooks/use-query-param";
import { useFeed } from "@/features/feed/hooks/use-feed";
import { Composer } from "@/features/feed/components/composer";
import { StoriesRow } from "@/features/feed/components/stories-row";
import { FeaturedArena } from "@/features/feed/components/featured-arena";
import { FeedItemCard } from "@/features/feed/components/feed-cards";
import type { Lane } from "@/features/feed/lib/types";
import { SnapFeed } from "@/features/feed/components/snap-feed";
import { useMarketView } from "@/lib/analytics";

// The workspace switcher above the timeline. Only "Feeds" lives here; the
// rest are the app's own surfaces, so they navigate rather than filter.
//
// Anything the right rail already surfaces is deliberately absent: Discover
// is the rail's search field plus Explore Categories, so a tab for it would
// be a third route to the same place.
const SECTIONS = [
  { label: "Feeds", href: null },
  { label: "Messages", href: "/notifications" },
  { label: "Notifications", href: "/notifications" },
  { label: "Activities", href: "/schedule" },
] as const;

// Lanes filter the timeline. "live" is not among them on purpose — the rail's
// Live now module and its Live Streams category already own that, and the
// featured hero is drawn from the same lane.
const LANES: Array<{ lane: Lane; label: string }> = [
  { lane: "for-you", label: "For You" },
  { lane: "following", label: "Following" },
  { lane: "platform", label: "Trending" },
];

const EMPTY_COPY: Record<Lane, { title: string; body: string }> = {
  "for-you": { title: "The square is quiet", body: "Nothing here yet — explore Live or the Store." },
  following: {
    title: "No one you follow has posted yet",
    body: "Explore Live to find creators worth following.",
  },
  live: { title: "Nothing live right now", body: "Streams and activities land here the moment they start." },
  platform: { title: "No platform news", body: "Official WorldStreet announcements appear here." },
};

function PostSkeleton() {
  return (
    <div className="ws-post space-y-3 p-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

// Mobile Home stays the vertical snap feed; desktop is the card timeline.
export function FeedPage() {
  const compose = useQueryParam("compose");
  const [lane, setLane] = useState<Lane>("for-you");
  const [composerOpen, setComposerOpen] = useState(false);
  const { authenticated } = useAuth();
  const feed = useFeed(lane);
  const sentinel = useInfiniteScroll(
    () => feed.fetchNextPage(),
    Boolean(feed.hasNextPage && !feed.isFetchingNextPage)
  );

  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const showComposer = composerOpen || compose === "1" || compose === "story";
  useMarketView("feed_viewed", { surface: "market_square_home", source: lane });

  return (
    <>
      <div className="md:hidden">
        <SnapFeed />
      </div>

      <div className="relative hidden px-4 py-4 md:block lg:px-6">
        {/* Section switcher left, the two creation actions right. */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((section) =>
              section.href ? (
                <Link
                  key={section.label}
                  href={section.href}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold text-meta transition-colors hover:bg-white/8 hover:text-body"
                >
                  {section.label}
                </Link>
              ) : (
                <span
                  key={section.label}
                  aria-current="page"
                  className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-ink"
                >
                  {section.label}
                </span>
              )
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/schedule"
              className="ws-hair ws-press flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold text-body transition-colors hover:bg-white/8"
            >
              <IconCalendar className="h-3.5 w-3.5" />
              Schedule Stream
              <IconChevronDown className="h-3 w-3" />
            </Link>
            <button
              onClick={() => setComposerOpen(true)}
              className="ws-press flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-ink transition-colors hover:bg-white"
            >
              <IconPlus className="h-3.5 w-3.5" />
              Create Post
            </button>
          </div>
        </div>

        {authenticated && (
          <div className="mb-4">
            <StoriesRow />
          </div>
        )}

        <div className="mb-4">
          <FeaturedArena />
        </div>

        {authenticated && showComposer && (
          <div className="ws-post mb-4">
            <Composer autoFocus asStory={compose === "story"} />
          </div>
        )}

        {/* Lane tabs, underlined in the design's rhythm. */}
        <div className="ws-hair mb-4 flex gap-5 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LANES.map(({ lane: value, label }) => (
            <button
              key={value}
              onClick={() => setLane(value)}
              aria-current={lane === value ? "true" : undefined}
              className={cn(
                "relative shrink-0 pb-2.5 text-[13px] transition-colors",
                lane === value ? "font-bold text-heading" : "font-medium text-meta hover:text-body"
              )}
            >
              {label}
              {lane === value && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {feed.isPending && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}
          {feed.isError && (
            <ErrorState error={feed.error} fallback="Couldn't load the feed." onRetry={() => feed.refetch()} />
          )}
          {feed.isSuccess && items.length === 0 && (
            <EmptyState glyph="◇" title={EMPTY_COPY[lane].title} body={EMPTY_COPY[lane].body} />
          )}
          {items.map((item) => (
            <div key={item.id} className="ws-enter">
              <FeedItemCard item={item} />
            </div>
          ))}
        </div>

        <div ref={sentinel} />
        {feed.isFetchingNextPage && (
          <div className="flex justify-center py-6">
            <Spinner className="h-6 w-6 text-meta" />
          </div>
        )}
        {feed.isSuccess && !feed.hasNextPage && items.length > 0 && (
          <p className="py-8 text-center text-sm text-meta">You&apos;re all caught up.</p>
        )}

        {/* Floating compose, pinned to the column's outer edge. */}
        {authenticated && (
          <button
            onClick={() => setComposerOpen(true)}
            aria-label="Create post"
            className="ws-press sticky bottom-6 ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent text-ink shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-colors hover:bg-white"
          >
            <IconPlus className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  );
}
