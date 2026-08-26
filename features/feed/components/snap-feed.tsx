"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { resolveCta } from "@/lib/deeplink";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useQueryParam } from "@/hooks/use-query-param";
import { reelItems, reelSlides } from "@/lib/reels";
import { useComposePrefill } from "@/hooks/use-compose-prefill";
import { LiveBadge, Pill } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/button";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Sheet } from "@/components/ui/sheet";
import { IconPlay } from "@/components/ui/icons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useFeed } from "@/features/feed/hooks/use-feed";
import { Composer } from "@/features/feed/components/composer";
import { StoriesRail } from "@/features/feed/components/stories-row";
import { PostSlide } from "@/features/feed/components/post-slide";
import { pricePillLabel } from "@/features/feed/components/feed-cards";
import type { FeedItem, Lane } from "@/features/feed/lib/types";

// The mobile frame's lane set and wording — "Live Streams" carries a live
// count badge, which is a real tally off the stream list, never a placeholder.
const LANES: Array<{ lane: Lane; label: string; counted?: boolean }> = [
  { lane: "for-you", label: "For You" },
  { lane: "following", label: "Following" },
  { lane: "live", label: "Live Streams", counted: true },
  { lane: "trending", label: "Trending" },
];

function SlideFor({ item }: { item: FeedItem }) {
  if (item.type === "post" && item.post) return <PostSlide post={item.post} />;

  if (item.type === "stream" && item.stream) {
    const stream = item.stream;
    return (
      <section className="ws-snap-item relative h-dvh w-full overflow-hidden">
        <GradientThumb seed={stream.id} className="h-full w-full">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />
          <div className="absolute left-4 top-14 flex items-center gap-2">
            {stream.status === "live" ? <LiveBadge /> : <Pill>{stream.scheduledAt ? formatDateTime(stream.scheduledAt) : "Scheduled"}</Pill>}
            <Pill tone="accent">{pricePillLabel(stream)}</Pill>
          </div>
          <div
            className="absolute inset-x-0 px-5"
            style={{ bottom: "calc(var(--ws-nav-h) + 16px)" }}
          >
            <p className="ws-display ws-text-shadow text-2xl leading-snug">{stream.title}</p>
            {stream.owner && (
              <p className="ws-text-shadow mt-1 text-sm text-body">{stream.owner.displayName}</p>
            )}
            <Link
              href={`/live/${stream.id}`}
              style={{ viewTransitionName: `stream-${stream.id}` }}
              className="ws-press mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-ink"
            >
              <IconPlay className="h-4 w-4" /> Watch
            </Link>
          </div>
        </GradientThumb>
      </section>
    );
  }

  if (item.type === "activity" && item.activity) {
    const activity = item.activity;
    const cta = resolveCta(activity.deepLink);
    return (
      <section className="ws-snap-item relative flex h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="ws-meta">{activity.type} · {formatDateTime(activity.startsAt)}</p>
        <p className="ws-display text-2xl leading-snug">{activity.title}</p>
        {cta && (
          <Link href={cta.href} className="ws-press mt-2 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-semibold text-ink">
            {cta.label}
          </Link>
        )}
      </section>
    );
  }

  if (item.type === "platform_event" && item.platformEvent) {
    const event = item.platformEvent;
    const cta = resolveCta(item.deepLink);
    return (
      <section className="ws-snap-item relative flex h-dvh w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="ws-meta text-accent">WorldStreet</p>
        <p className="ws-display text-2xl leading-snug">{event.title}</p>
        {event.body && <p className="max-w-sm text-sm text-meta">{event.body}</p>}
        {cta && (
          <Link href={cta.href} className="text-sm font-semibold text-accent hover:underline">
            {cta.label} →
          </Link>
        )}
      </section>
    );
  }
  return null;
}

// Mobile Home: one item per viewport, mandatory snap, TikTok-grammar rails.
export function SnapFeed({ liveCount = 0 }: { liveCount?: number }) {
  const [lane, setLane] = useState<Lane>("for-you");
  const [composerOpen, setComposerOpen] = useState(false);
  // "Your Story" and the sidebar Post action both navigate to /?compose=…;
  // on mobile this component IS home, so it has to honour the parameter or
  // those entries land on an unchanged timeline.
  const compose = useQueryParam("compose");
  // A share handed in from another Ark product — validated before it is used.
  const prefill = useComposePrefill();
  const composeStory = compose === "story";
  const composeOpen = composerOpen || compose === "1" || composeStory;

  // Closing has to drop the parameter as well, or the sheet reopens from the
  // URL on the very next render and cannot be dismissed at all.
  const closeComposer = () => {
    setComposerOpen(false);
    if (compose !== null) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };
  const feed = useFeed(lane);

  // Reels only, and endless. Both rules are pure and live in lib/reels.ts,
  // where they are pinned by tests.
  const items = useMemo(
    () => reelItems(feed.data?.pages.flatMap((page) => page.items) ?? []),
    [feed.data?.pages]
  );
  const [cycle, setCycle] = useState(0);
  const exhausted = feed.isSuccess && !feed.hasNextPage && items.length > 0;
  const slides = useMemo(() => reelSlides(items, cycle, exhausted), [items, cycle, exhausted]);

  // Paging while the server has more, looping once it does not. One sentinel
  // for both, so the reader never sees a boundary between them.
  const sentinel = useInfiniteScroll(
    () => (feed.hasNextPage ? feed.fetchNextPage() : setCycle((pass) => pass + 1)),
    Boolean((feed.hasNextPage && !feed.isFetchingNextPage) || exhausted)
  );


  return (
    // The immersive feed is FULL-BLEED: it cancels the shell's mobile padding
    // so a slide's `h-dvh` is the real viewport rather than the viewport minus
    // the top strip. Without this every slide ran 48px past the bottom of the
    // screen and its author row and action rail were pushed underneath the tab
    // bar — the furniture was drawn, just off-screen. The chrome above still
    // floats over the media (it is all `fixed`), which is the point of the
    // grammar; only the measurement was wrong.
    <div className="relative mt-[calc(-1*var(--ws-topbar-h))] mb-[calc(-1*var(--ws-nav-h))]">
      {/* The mobile frame's lane bar: one 20px-radius slab at 92% near-black
          with an 18% hairline, the active lane simply brighter. */}
      <div className="fixed inset-x-0 top-11 z-30 px-[5px]">
        <div className="flex items-center justify-between rounded-[20px] border border-white/[0.18] bg-[#0a0a0a]/92 px-2 py-[3px] backdrop-blur-sm">
          {LANES.map(({ lane: value, label, counted }) => (
            <button
              key={value}
              onClick={() => setLane(value)}
              aria-current={lane === value ? "true" : undefined}
              className={cn(
                "ws-press flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[12px] leading-5",
                lane === value ? "text-white" : "text-white/50"
              )}
            >
              {label}
              {counted && liveCount > 0 && (
                <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E7000B] px-1.5 text-[12px] leading-5 text-white">
                  {liveCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Circular story rail, the mobile frame's shape (the desktop column
          uses portrait cards instead). */}
      <div className="fixed inset-x-0 top-[92px] z-30 px-[5px]">
        <StoriesRail />
      </div>

      <div className="ws-snap-feed h-dvh snap-y snap-mandatory overflow-y-auto">
        {feed.isPending && (
          <div className="flex h-dvh items-center justify-center">
            <Spinner className="h-7 w-7 text-grey-600" />
          </div>
        )}
        {feed.isError && (
          <div className="flex h-dvh items-center justify-center px-6">
            <ErrorState error={feed.error} fallback="Couldn't load the feed." onRetry={() => feed.refetch()} />
          </div>
        )}
        {feed.isSuccess && items.length === 0 && (
          <div className="flex h-dvh items-center justify-center px-6">
            <EmptyState
              glyph="◇"
              title="No reels yet"
              body="Photos and videos land here. Text posts live in Explore."
            />
          </div>
        )}
        {slides.map(({ item, key }) => (
          <SlideFor key={key} item={item} />
        ))}
        <div ref={sentinel} />
        {feed.isFetchingNextPage && (
          <div className="flex h-24 items-center justify-center">
            <Spinner className="h-5 w-5 text-grey-600" />
          </div>
        )}
      </div>

      {/* No compose button here: AppShell owns the single fixed one. This
          screen used to draw its own at top-right, which is why the control
          appeared in two places at once on mobile home. */}
      <Sheet
        open={composeOpen}
        onClose={closeComposer}
        title={composeStory ? "New story" : "New post"}
      >
        <Composer asStory={composeStory} prefill={prefill} onDone={closeComposer} />
      </Sheet>
    </div>
  );
}
