"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { PostSlide } from "@/features/feed/components/post-slide";
import { reelSlides } from "@/lib/reels";
import type { VideoItem } from "@/lib/video-context";

/**
 * Reels: one video per screen, vertical snap, and no bottom.
 *
 * This is the surface home used to be. It moved here because a general feed
 * and a reels feed want opposite things: a feed is read, and reels are
 * watched. Text posts in a full-viewport slide were a sentence floating in a
 * wall of black, and video in a timeline card is a thumbnail nobody plays.
 * Home is the timeline now, and this is where video lives.
 *
 * It fills its container rather than the viewport, so the same component works
 * inside Explore's column on desktop and edge to edge on a phone.
 */
export function ReelsFeed({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isPending,
  reservedSpace = "0px",
}: {
  items: VideoItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isPending: boolean;
  /**
   * Chrome that sits ABOVE the feed and eats into the screen, as a CSS length.
   *
   * Explore mounts the reels directly under its search bar and needs none.
   * Home mounts them under the lane switcher, and without accounting for it a
   * "screenful" would be taller than what is left of the screen: every slide
   * would sit part-scrolled, which is exactly how a reels feed stops feeling
   * like one.
   */
  reservedSpace?: string;
}) {
  /**
   * Reels do not end. While the server has pages we page normally, and once it
   * is exhausted the loaded reels repeat rather than stopping: reaching a
   * bottom is the moment somebody leaves. The repeat costs no request, and it
   * only begins once the server is genuinely out of pages, or a reader would
   * be shown the same clip twice while fresh ones were still waiting.
   */
  const [cycle, setCycle] = useState(0);
  const exhausted = !isPending && !hasNextPage && items.length > 0;
  const slides = reelSlides(items, cycle, exhausted);

  const sentinel = useInfiniteScroll(
    () => (hasNextPage ? fetchNextPage() : setCycle((pass) => pass + 1)),
    (hasNextPage && !isFetchingNextPage) || exhausted
  );

  if (isPending) {
    return (
      <div className="flex h-[70dvh] items-center justify-center">
        <Spinner className="h-7 w-7 text-grey-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-[70dvh] items-center justify-center px-6">
        <EmptyState
          glyph="◇"
          title="No reels yet"
          body="Videos land here. Photos and writing live in the timeline."
        />
      </div>
    );
  }

  return (
    <div
      className="ws-snap-feed snap-y snap-mandatory overflow-y-auto"
      // The reels column is the height of what is left of the screen, so a
      // slide is one screenful wherever it is mounted.
      style={{ height: `calc(100dvh - var(--ws-topbar-h) - var(--ws-nav-h) - ${reservedSpace})` }}
    >
      {slides.map(({ item, key }) => (
        <PostSlide key={key} post={item} />
      ))}
      <div ref={sentinel} />
    </div>
  );
}
