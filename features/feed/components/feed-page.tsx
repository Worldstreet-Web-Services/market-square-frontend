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
import type { Lane, Post } from "@/features/feed/lib/types";
import type { Profile } from "@/lib/api/schemas";
import { SnapFeed } from "@/features/feed/components/snap-feed";
import { useMarketView } from "@/lib/analytics";

// The workspace switcher above the timeline, in the design's order. "Feeds"
// is the current surface and renders as the active chip; every other entry is
// a real route, so the list carries no "no destination" case.
const SECTIONS: Array<{ label: string; href: string }> = [
  { label: "Discover", href: "/discover" },
  { label: "Messages", href: "/messages" },
  { label: "Notifications", href: "/notifications" },
  { label: "Arkmarks", href: "/arkmarks" },
];

// Lanes filter the timeline, in the design's order. Every one of these is a
// real backend lane — `reels` and `trending` included.
const LANES: Array<{ lane: Lane; label: string }> = [
  { lane: "for-you", label: "For You" },
  { lane: "live", label: "Live Streaming" },
  { lane: "reels", label: "Reels" },
  { lane: "following", label: "Following" },
  { lane: "trending", label: "Trending" },
];

/**
 * Empty copy per lane.
 *
 * An empty lane is the normal state of a young square, so each one says WHY it
 * is empty and offers the action that fills it. A bare "no data" panel reads
 * as a broken app; a reason plus a next step reads as an early one.
 *
 * `cta` is resolved against the viewer: `authed` gates actions that need a
 * session, so a signed-out reader is never sent at a wall.
 */
interface LaneEmpty {
  title: string;
  body: string;
  cta?: { label: string; href: string; authed?: boolean };
}

const EMPTY_COPY: Record<Lane, LaneEmpty> = {
  "for-you": {
    title: "The square is quiet",
    body: "Nothing has been posted yet. Be the first, or go and find people worth following.",
    cta: { label: "Find creators", href: "/spotlight" },
  },
  following: {
    title: "You're not following anyone yet",
    body: "This lane shows posts from people you follow. Follow a few and it fills up.",
    cta: { label: "Find people to follow", href: "/spotlight" },
  },
  live: {
    title: "Nobody's live right now",
    body: "Live streams and scheduled sessions appear here the moment they start.",
    cta: { label: "Go live", href: "/studio", authed: true },
  },
  reels: {
    title: "No clips yet",
    body: "Reels are posts with video. Publish one and it lands here.",
    cta: { label: "Create a post", href: "/?compose=1", authed: true },
  },
  trending: {
    title: "Nothing trending yet",
    body: "Once posts start collecting likes and replies, the busiest land here.",
    cta: { label: "Browse the feed", href: "/" },
  },
  platform: {
    title: "No platform news",
    body: "Official WorldStreet announcements appear here.",
    cta: { label: "Browse the ARK Store", href: "/store" },
  },
};

/** The action under an empty lane, or nothing when it needs a session. */
function LaneCta({ empty, authenticated }: { empty: LaneEmpty; authenticated: boolean }) {
  const cta = empty.cta;
  if (!cta || (cta.authed && !authenticated)) return null;
  return (
    <Link
      href={cta.href}
      className="ws-press inline-flex rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
    >
      {cta.label}
    </Link>
  );
}

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
export function FeedPage({
  followSlot,
  liveCount,
}: {
  followSlot?: (author: Profile) => React.ReactNode;
  /** Real count of live streams, for the mobile lane badge. */
  liveCount?: number;
}) {
  const compose = useQueryParam("compose");
  const [lane, setLane] = useState<Lane>("for-you");
  const [composerOpen, setComposerOpen] = useState(false);
  // The post being quoted, if the composer was opened from a repost menu.
  const [quoting, setQuoting] = useState<Post | null>(null);
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
        <SnapFeed liveCount={liveCount} />
      </div>

      <div className="relative hidden px-4 py-4 md:block lg:px-6">
        {/* Section switcher and the two creation actions share one long
            outlined pill — that enclosure is the design's, not decoration. */}
        <div className="ws-tabbar mb-4 flex items-center gap-3 p-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span
              aria-current="page"
              className="ws-btn-silver shrink-0 rounded-full px-4 py-2 text-[14px] font-medium"
            >
              Feeds
            </span>
            {SECTIONS.map((section) => (
              <Link
                key={section.label}
                href={section.href}
                className="shrink-0 rounded-full px-4 py-2 text-[12px] font-bold text-white/40 transition-colors hover:bg-white/8 hover:text-body"
              >
                {section.label}
              </Link>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/schedule"
              className="ws-press flex shrink-0 items-center gap-2.5 rounded-full bg-[#979797]/[0.18] px-4 py-2 text-[14px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-[#979797]/25"
            >
              <IconCalendar className="h-4 w-4" />
              Schedule Stream
              <IconChevronDown className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => setComposerOpen(true)}
              className="ws-btn-featured ws-press flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-medium transition-opacity hover:opacity-90"
            >
              <IconPlus className="h-4 w-4" />
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
            <Composer
              autoFocus
              asStory={compose === "story"}
              quoted={quoting}
              onDone={() => {
                setQuoting(null);
                setComposerOpen(false);
              }}
            />
          </div>
        )}

        {/* Lane tabs. The rule runs the full width at 8% white and the active
            segment sits on top of it in solid white — not an amber bar. */}
        <div className="mb-4 border-b border-white/8">
          <div
            aria-label="Timeline"
            className="flex justify-between overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {LANES.map(({ lane: value, label }) => (
              <button
                key={value}
                onClick={() => setLane(value)}
                aria-current={lane === value ? "true" : undefined}
                className={cn(
                  "relative shrink-0 px-2.5 pb-2.5 pt-2.5 text-[12px] font-bold transition-colors",
                  lane === value ? "text-grey-100" : "text-white/40 hover:text-body"
                )}
              >
                {label}
                {lane === value && (
                  <span className="absolute inset-x-0 -bottom-px mx-auto h-0.5 w-[74px] bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {feed.isPending && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}
          {feed.isError && (
            <ErrorState error={feed.error} fallback="Couldn't load the feed." onRetry={() => feed.refetch()} />
          )}
          {feed.isSuccess && items.length === 0 && (
            <EmptyState
              glyph="◇"
              title={EMPTY_COPY[lane].title}
              body={EMPTY_COPY[lane].body}
              action={<LaneCta empty={EMPTY_COPY[lane]} authenticated={authenticated} />}
            />
          )}
          {items.map((item) => (
            <div key={item.id} className="ws-enter">
              <FeedItemCard
                item={item}
                followSlot={followSlot}
                onQuote={(post) => {
                  setQuoting(post);
                  setComposerOpen(true);
                }}
              />
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
            className="ws-btn-silver ws-press sticky bottom-6 ml-auto flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.6)] transition-opacity hover:opacity-90"
          >
            <IconPlus className="h-7 w-7" />
          </button>
        )}
      </div>
    </>
  );
}
