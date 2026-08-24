"use client";

import { useRef, useState } from "react";
import { isVideoUrl } from "@/lib/media";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime, relativeTime } from "@/lib/format";
import { resolveDeepLink } from "@/lib/deeplink";
import { useGate } from "@/hooks/use-gate";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Avatar } from "@/components/ui/avatar";
import { LiveBadge, Pill, VerifiedBadge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/button";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { Sheet } from "@/components/ui/sheet";
import { IconComment, IconHeart, IconPlay, IconPlus } from "@/components/ui/icons";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useFeed, useLikePost } from "@/features/feed/hooks/use-feed";
import { Composer } from "@/features/feed/components/composer";
import { StoriesRail } from "@/features/feed/components/stories-row";
import { CommentsSheet } from "@/features/feed/components/comments-sheet";
import { pricePillLabel } from "@/features/feed/components/feed-cards";
import type { FeedItem, Lane, Post } from "@/features/feed/lib/types";

// The mobile frame's lane set and wording — "Live Streams" carries a live
// count badge, which is a real tally off the stream list, never a placeholder.
const LANES: Array<{ lane: Lane; label: string; counted?: boolean }> = [
  { lane: "for-you", label: "For You" },
  { lane: "following", label: "Following" },
  { lane: "live", label: "Live Streams", counted: true },
  { lane: "platform", label: "Trending" },
];

const DOUBLE_TAP_MS = 300;

function PostSlide({ post }: { post: Post }) {
  const like = useLikePost();
  const gate = useGate();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [muted, setMuted] = useState(true);
  const lastTap = useRef(0);
  const hasVideo = Boolean(post.mediaUrl && isVideoUrl(post.mediaUrl));

  const doLike = () => gate(() => like.mutate({ postId: post.id, like: !post.likedByMe }));

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      setBurst((n) => n + 1);
      if (!post.likedByMe) gate(() => like.mutate({ postId: post.id, like: true }));
    } else {
      lastTap.current = now;
      // Sound only on an explicit tap — never autoplayed.
      if (hasVideo) setMuted((v) => !v);
    }
  };

  const cta = post.deepLink ? resolveDeepLink(post.deepLink) : null;
  const author = post.author;

  return (
    <section className="ws-snap-item relative flex h-dvh w-full flex-col justify-center overflow-hidden">
      {/* content stage: media fills the slide; text posts stay typographic. */}
      {post.mediaUrl &&
        (hasVideo ? (
          <video
            src={post.mediaUrl}
            muted={muted}
            autoPlay
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- author-supplied media
          <img src={post.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ))}
      <button className="absolute inset-0 cursor-default" onClick={onTap} aria-label="Post" />
      {hasVideo && muted && (
        <span className="ws-glass pointer-events-none absolute left-4 top-14 rounded-full px-2.5 py-1 text-[10px] font-semibold text-body">
          Tap for sound
        </span>
      )}
      <div className={cn("pointer-events-none px-6 pb-40", post.mediaUrl && "ws-text-shadow")}>
        <p className="ws-display text-2xl leading-snug">{post.text}</p>
      </div>

      {/* double-tap heart burst */}
      {burst > 0 && (
        <span
          key={burst}
          className="ws-heart-burst pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-like"
          aria-hidden
        >
          <IconHeart className="h-24 w-24" filled />
        </span>
      )}

      {/* bottom scrim: author + caption meta */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-28">
        <div className="min-w-0">
          {author && (
            <Link href={`/u/${author.username}`} className="pointer-events-auto flex items-center gap-2">
              <Avatar name={author.displayName} src={author.avatarUrl} size={36} />
              <span className="ws-text-shadow flex items-center gap-1.5 text-sm font-semibold text-heading">
                {author.displayName}
                <VerifiedBadge verification={author.verification} />
              </span>
              <span className="ws-text-shadow text-xs text-meta">{relativeTime(post.createdAt)}</span>
            </Link>
          )}
          {cta && (
            <Link
              href={cta.href}
              target={cta.external ? "_blank" : undefined}
              rel={cta.external ? "noreferrer" : undefined}
              className="ws-press pointer-events-auto mt-3 inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-ink"
            >
              {cta.label}
            </Link>
          )}
        </div>
        {/* right action rail */}
        <div className="pointer-events-auto flex flex-col items-center gap-4 pb-1">
          <button onClick={doLike} aria-label={post.likedByMe ? "Unlike" : "Like"} className="ws-press flex flex-col items-center gap-0.5">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full bg-black/40",
                post.likedByMe ? "text-like" : "text-heading"
              )}
            >
              <IconHeart className="h-5 w-5" filled={post.likedByMe} />
            </span>
            <span className="tnum ws-text-shadow text-xs text-body">{formatCount(post.likeCount)}</span>
          </button>
          <button onClick={() => setCommentsOpen(true)} aria-label="Comments" className="ws-press flex flex-col items-center gap-0.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-heading">
              <IconComment className="h-5 w-5" />
            </span>
            <span className="tnum ws-text-shadow text-xs text-body">{formatCount(post.commentCount)}</span>
          </button>
        </div>
      </div>
      <CommentsSheet postId={post.id} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
    </section>
  );
}

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
          <div className="absolute inset-x-0 bottom-28 px-5">
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
    const cta = activity.deepLink ? resolveDeepLink(activity.deepLink) : null;
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
    const cta = item.deepLink ? resolveDeepLink(item.deepLink) : null;
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
  const { authenticated } = useAuth();
  const [composerOpen, setComposerOpen] = useState(false);
  const feed = useFeed(lane);
  const sentinel = useInfiniteScroll(
    () => feed.fetchNextPage(),
    Boolean(feed.hasNextPage && !feed.isFetchingNextPage)
  );
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="relative">
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
            <EmptyState glyph="◇" title="The square is quiet" body="Nothing here yet — explore Live or the Store." />
          </div>
        )}
        {items.map((item) => (
          <SlideFor key={item.id} item={item} />
        ))}
        <div ref={sentinel} />
        {feed.isFetchingNextPage && (
          <div className="flex h-24 items-center justify-center">
            <Spinner className="h-5 w-5 text-grey-600" />
          </div>
        )}
      </div>

      {/* compose */}
      {authenticated && (
        <button
          onClick={() => setComposerOpen(true)}
          aria-label="New post"
          className="ws-press ws-glass fixed right-4 top-24 z-30 flex h-11 w-11 items-center justify-center rounded-full text-heading"
        >
          <IconPlus className="h-5 w-5" />
        </button>
      )}
      <Sheet open={composerOpen} onClose={() => setComposerOpen(false)} title="New post">
        <Composer />
      </Sheet>
    </div>
  );
}
