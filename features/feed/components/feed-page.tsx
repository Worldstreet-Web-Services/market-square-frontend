"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { IconCalendar, IconChevronDown, IconPlus } from "@/components/ui/icons";
import { useQueryParam } from "@/hooks/use-query-param";
import { useComposePrefill } from "@/hooks/use-compose-prefill";
import { useFeed } from "@/features/feed/hooks/use-feed";
import { Composer } from "@/features/feed/components/composer";
import { StoriesRow } from "@/features/feed/components/stories-row";
import { Hallway } from "@/features/houses/components/hallway";
import { TrendingDiscussions } from "@/features/discovery";
import { VideoViewer } from "@/features/feed/components/video-viewer";
import { isVideoPost } from "@/lib/media";
import type { VideoItem } from "@/lib/video-context";
import { FeaturedArena } from "@/features/feed/components/featured-arena";
import { FeedItemCard } from "@/features/feed/components/feed-cards";
import type { Lane, Post } from "@/features/feed/lib/types";
import type { Profile } from "@/lib/api/schemas";
import { MARKET_FLAGS } from "@/lib/market-config";
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

/*
  Lanes filter the timeline, in the design's order.

  REELS IS GONE, by product decision and not by accident. The endless vertical
  scroll is the shape of a video product, and Market Square is not one — it is
  a place to talk in a room and meet the people in it. A lane that swallows a
  reader for twenty minutes is in direct competition with that, and while it
  existed Home had two centres.

  What did NOT go with it: video in a post, the upload that makes one, and the
  story viewer. Media still belongs in the feed. What it no longer does is
  become a river you fall into — to see what somebody has posted you go to
  their profile, which is where their media lives.
*/
const LANES: Array<{ lane: Lane; label: string }> = [
  { lane: "for-you", label: "For You" },
  { lane: "live", label: "Live Streaming" },
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
    // Sending readers to the Store from a news lane was always a non-sequitur;
    // with `storeNav` off it would also be the one place still promoting it.
    ...(MARKET_FLAGS.storeNav
      ? { cta: { label: "Browse the ARK Store", href: "/store" } }
      : {}),
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
  tipSlot,
}: {
  followSlot?: (author: Profile) => React.ReactNode;
  /** Composed from outside the slice — the tip control lives in the tips
   *  slice and takes the POST, since a tip goes to `/posts/:id/tips`. */
  tipSlot?: (post: Post) => React.ReactNode;
  /** Real count of live streams, for the mobile lane badge. */
}) {
  const compose = useQueryParam("compose");
  const prefill = useComposePrefill();
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

  const items = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data?.pages]
  );

  /**
   * The clips in this lane, in lane order.
   *
   * The viewer scrolls THIS list, so swiping up inside it walks the timeline
   * the reader was already in rather than some separate video feed. Paging is
   * the lane's own pager, so a swipe past the loaded page fetches the next one
   * exactly as scrolling the timeline would.
   */
  const videoItems = useMemo(
    () =>
      items.flatMap((item) =>
        item.type === "post" && item.post && isVideoPost(item.post)
          ? [item.post as VideoItem]
          : []
      ),
    [items]
  );

  /**
   * What the full-screen viewer scrolls: every MEDIA post of the lane, photos
   * included, in lane order.
   *
   * Clips only would strand a reader who expanded a photo on a single slide
   * with nothing above or below it, and would skip past the photos of the lane
   * they were reading. The Reels lane keeps `videoItems`, because reels are
   * clips and a still frame in a reels feed is a dead screen.
   */
  const mediaItems = useMemo(
    () =>
      items.flatMap((item) =>
        item.type === "post" && item.post?.mediaUrl ? [item.post as VideoItem] : []
      ),
    [items]
  );
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);

  // The card morphs into the player. Feature-detected, and skipped under
  // reduced motion, the same rule Explore's grid uses.
  const openMedia = (post: Post) => {
    const apply = () => setOpenVideoId(post.id);
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }
    document.startViewTransition(apply);
  };
  const showComposer = composerOpen || compose === "1" || compose === "story";
  useMarketView("feed_viewed", { surface: "market_square_home", source: lane });

  return (
    <>
      {/* One timeline, every width. Mobile used to get a full-viewport snap
          feed instead, which is why a text post arrived as a sentence floating
          in a wall of black and why the phone never had the reading surface
          the desktop did. Video moved to Explore's reels, where it is watched
          rather than scrolled past. */}
      <div className="relative px-4 py-4 lg:px-6">
        {/* Section switcher and the two creation actions share one long
            outlined pill — that enclosure is the design's, not decoration.
            Desktop only: on a phone every one of these sections is already a
            tab in the bottom bar, so the row was a second copy of the same
            navigation sitting above the stories, and one that ran off the
            right edge because the pill cannot fit four labels at that width. */}
        <div className="ws-tabbar mb-4 hidden items-center gap-3 p-1.5 md:flex">
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

          {/* Hidden on a phone: the shell's floating create button already
              covers posting there, and these two would squeeze the section
              pills into nothing. */}
          <div className="hidden shrink-0 items-center gap-3 md:flex">
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
              className="ws-btn-create ws-press flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2 text-[14px] font-medium transition-opacity hover:opacity-90"
            >
              <IconPlus className="h-4 w-4" />
              Create Post
            </button>
          </div>
        </div>

        {/* Reels is a mode, not a filter. The story rail and the hero are
            browsing furniture: left in place they push the first clip halfway
            down the screen, which is the whole reason home's reels did not
            feel like Explore's. */}
        {/*
          The hallway leads.

          Home opened on a composer and a feed — a product about what people
          SAID. What 2.0 is for is what people are saying right now, out loud,
          in a room you can walk into, so the open rooms go above everything
          and the feed reads underneath them.

          It renders nothing when no house is open, so a quiet evening costs no
          space, and it sits outside the reels lane for the same reason the
          stories row does: browsing furniture pushes the first clip halfway
          down the screen.
        */}
        {MARKET_FLAGS.houses && (
          <div className="mb-4">
            <Hallway />
          </div>
        )}

        {/*
          What the square is talking about, on the overview where it belongs.

          It already existed — in the right rail, which is `hidden lg:block`.
          So the one thing the brief names as the point of the place ("they
          just discussing about any new discussion, that was the top topic")
          was invisible to every reader on a phone. An overview that only
          overviews on a desktop is not an overview.

          Below the hallway, above the feed: a room happening now beats a
          subject being discussed, and both beat a post from this morning.
        */}
        <div className="mb-4 lg:hidden">
          <TrendingDiscussions limit={4} />
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
              prefill={prefill}
              quoted={quoting}
              onDone={() => {
                setQuoting(null);
                setComposerOpen(false);
                // Drop the share parameters too, or reopening the composer
                // re-seeds the draft that was just published.
                if (compose !== null) {
                  window.history.replaceState(null, "", window.location.pathname);
                }
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
                onOpenMedia={openMedia}
                tipSlot={tipSlot}
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

        {/* The floating compose button used to live here, which is why it
            existed on home and nowhere else. AppShell owns it now and renders
            it on every surface that allows composing — see allowsCompose. The
            in-timeline composer below stays: the stories rail and the empty
            states open it in place via `?compose=1` / `?compose=story`. */}
      </div>

      {/* Full screen, swipeable, paging the same lane. This is the promotion a
          tap on a video card performs. */}
      {openVideoId && (
        <VideoViewer
          items={mediaItems}
          activeId={openVideoId}
          onActiveChange={setOpenVideoId}
          onClose={() => setOpenVideoId(null)}
          hasNextPage={Boolean(feed.hasNextPage)}
          isFetchingNextPage={feed.isFetchingNextPage}
          fetchNextPage={() => void feed.fetchNextPage()}
          morphNameFor={(mediaId) => `media-${mediaId}`}
        />
      )}
    </>
  );
}
