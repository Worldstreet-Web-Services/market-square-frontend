"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Spinner } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useFeed } from "@/features/feed/hooks/use-feed";
import { Composer } from "@/features/feed/components/composer";
import { StoriesRow } from "@/features/feed/components/stories-row";
import { FeedItemCard } from "@/features/feed/components/feed-cards";
import { HappeningNow } from "@/features/feed/components/happening-now";
import type { Lane } from "@/features/feed/lib/types";
import { SnapFeed } from "@/features/feed/components/snap-feed";

const LANES: Array<{ lane: Lane; label: string }> = [
  { lane: "for-you", label: "For you" },
  { lane: "following", label: "Following" },
  { lane: "live", label: "Live" },
  { lane: "platform", label: "Platform" },
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

// Mobile Home is the vertical snap feed; desktop keeps the comparison grid.
export function FeedPage() {
  const [lane, setLane] = useState<Lane>("for-you");
  const { authenticated } = useAuth();
  const feed = useFeed(lane);
  const sentinel = useInfiniteScroll(
    () => feed.fetchNextPage(),
    Boolean(feed.hasNextPage && !feed.isFetchingNextPage)
  );

  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <div className="md:hidden">
        <SnapFeed />
      </div>
      <div className="mx-auto hidden max-w-6xl gap-6 px-4 py-6 md:flex lg:px-6">
      <div className="min-w-0 flex-1 space-y-4">
        {authenticated && <StoriesRow />}
        {authenticated && <Composer />}

        <div className="ws-inset flex gap-1 p-1">
          {LANES.map(({ lane: value, label }) => (
            <button
              key={value}
              onClick={() => setLane(value)}
              className={cn(
                "flex-1 rounded-full py-2 text-xs font-semibold transition-colors sm:text-sm",
                lane === value ? "bg-accent text-ink" : "text-grey-400 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {feed.isPending && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}
        {feed.isError && (
          <ErrorState error={feed.error} fallback="Couldn't load the feed." onRetry={() => feed.refetch()} />
        )}
        {feed.isSuccess && items.length === 0 && (
          <EmptyState glyph="◇" title={EMPTY_COPY[lane].title} body={EMPTY_COPY[lane].body} />
        )}

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="ws-enter">
              <FeedItemCard item={item} />
            </div>
          ))}
        </div>

        <div ref={sentinel} />
        {feed.isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Spinner className="h-5 w-5 text-grey-500" />
          </div>
        )}
        {feed.isSuccess && !feed.hasNextPage && items.length > 0 && (
          <p className="py-6 text-center text-xs text-grey-600">You&apos;re all caught up.</p>
        )}
      </div>

      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-6">
          <HappeningNow />
        </div>
      </aside>
      </div>
    </>
  );
}
