"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryParam } from "@/hooks/use-query-param";
import { useComposePrefill } from "@/hooks/use-compose-prefill";
import { useFeed, useFeedHead } from "@/features/feed/hooks/use-feed";
import { useLaneSignal } from "@/features/feed/hooks/use-lane-signal";
import { Composer } from "@/features/feed/components/composer";
import { StoriesRow } from "@/features/feed/components/stories-row";
import { TrendingDiscussions } from "@/features/discovery";
import { VideoViewer } from "@/features/feed/components/video-viewer";
import type { VideoItem } from "@/lib/video-context";
import { FeedItemCard } from "@/features/feed/components/feed-cards";
import type { Lane, Post } from "@/features/feed/lib/types";
import type { Profile } from "@/lib/api/schemas";
import { MARKET_FLAGS } from "@/lib/market-config";
import { useMarketView } from "@/lib/analytics";
import { TopicTabs, type TopicTab } from "@/features/feed/components/topic-tabs";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useMe } from "@/hooks/use-me";
import { useNewPosts } from "@/features/feed/hooks/use-new-posts";
import { NewPostsPill } from "@/features/feed/components/new-posts-pill";

/** How many posts stand between the top of the feed and "Join a community". */
const BEFORE_COMMUNITY = 1;
/**
 * ...and how many before "Suggested Pals" (540:19351).
 *
 * Far enough in that the reader has seen what the square sounds like before
 * being asked to meet anybody, and not so far that it only exists for people
 * who scroll. The file cannot settle it — it draws the rail on its own — so
 * four is a judgement call, changed by this line alone.
 *
 * A CEILING, NOT A THRESHOLD. Both this and BEFORE_COMMUNITY fall back to the
 * last post when the feed is shorter, so neither section disappears on a young
 * square. On a one-post feed that stacks the community grid and the pals rail
 * after the same post, in that order; both are invitations to go somewhere
 * else, and showing them is better than showing neither.
 */
const BEFORE_PALS = 4;

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
  winkSlot,
  tipSlot,
  topicTabs = [],
  roomsSlot,
  friendsSlot,
  communitySlot,
  palsSlot,
}: {
  followSlot?: (author: Profile) => React.ReactNode;
  winkSlot?: (author: Profile) => React.ReactNode;
  /** Composed from outside the slice — the tip control lives in the tips
   *  slice and takes the POST, since a tip goes to `/posts/:id/tips`. */
  tipSlot?: (post: Post) => React.ReactNode;
  /**
   * The shared topic vocabulary for the tab row (node 225:3352), supplied by
   * the layout. `GET /topics` lives in the DISCOVERY slice and slices never
   * import each other — and this is the data rather than a node, because the
   * row's selection drives this component's own query.
   */
  topicTabs?: readonly TopicTab[];
  /**
   * The three sections the file puts around the timeline, each composed in
   * `components/layout` because each reads a slice this one may not import:
   * the open gist rooms (225:3822), the people deck (225:3374) and the
   * community grid (258:5545).
   */
  roomsSlot?: React.ReactNode;
  friendsSlot?: React.ReactNode;
  communitySlot?: React.ReactNode;
  /** The pals rail (540:19351), dropped a few posts into the timeline. */
  palsSlot?: React.ReactNode;
}) {
  const compose = useQueryParam("compose");
  const prefill = useComposePrefill();
  /*
    THE TAB ROW SELECTS A TOPIC, NOT A LANE — node 225:3352.

    Home used to head the timeline with `For You · Following · Trending`, which
    are three ways of RANKING the same posts. The file heads it with the
    subjects the square is talking about, which is the proposition of the
    product. `null` is "For you" — the unfiltered lane.

    The lane stays `for-you` throughout: a topic narrows what is in the lane, it
    does not change how the lane is ranked. `GET /feed?topics=` does the
    narrowing server-side.
  */
  const [topic, setTopic] = useState<string | null>(null);
  /*
    THE TIMELINE RUNS ON, AND "JOIN A COMMUNITY" SITS INSIDE IT.

    It used to show three posts and stop at a "Load more" row (242:4890), for
    one reason: the community grid came after the feed, and a grid placed under
    a list that never ends can never be reached. Interleaving the grid instead
    removes that constraint — it now sits after the first post, where it is on
    the first screen whatever the feed does — so the floor under the feed came
    out with it and the timeline pages itself as the reader scrolls.

    Nothing is held back any more: every post that has been fetched is on the
    page, and reaching the end asks for the next page rather than waiting to be
    asked.
  */
  const lane: Lane = "for-you";
  const [composerOpen, setComposerOpen] = useState(false);
  // The post being quoted, if the composer was opened from a repost menu.
  const [quoting, setQuoting] = useState<Post | null>(null);
  const { authenticated } = useAuth();
  const topics = useMemo(() => (topic ? [topic] : []), [topic]);
  const feed = useFeed(lane, topics);

  /* `For you` plus whatever vocabulary the layout supplied, in the backend's
     own order — nothing hard-coded, so a topic added upstream appears with no
     client change. */
  const tabs: TopicTab[] = useMemo(
    () => [{ key: null, label: "For you" }, ...topicTabs],
    [topicTabs]
  );

  /*
    THE HEAD CHECK (`useFeedHead`) runs every 30 seconds while the tab is
    visible and the timeline has loaded. Anything it returns that the
    timeline does not already have is put IN FRONT of the loaded list, by
    id — the timeline's own order for what it has, the head's for what is
    new. From there `useNewPosts` holds the new items behind the pill while
    the reader is scrolled, and merges them at the top. Nothing here decides
    what is "new"; that is the hold's job, against what the reader has seen.
  */
  const head = useFeedHead(lane, topics, feed.isSuccess);
  // The ws-gateway's "head changed" frame re-asks that same head at once —
  // when a gateway is configured; otherwise the tick above is the whole story.
  useLaneSignal(lane, topics, feed.isSuccess);
  const loaded = useMemo(() => {
    const paged = feed.data?.pages.flatMap((page) => page.items) ?? [];
    const have = new Set(paged.map((item) => item.id));
    const fresh = (head.data?.items ?? []).filter((item) => !have.has(item.id));
    return fresh.length > 0 ? [...fresh, ...paged] : paged;
  }, [feed.data?.pages, head.data?.items]);
  /*
    Everything that has been fetched — except what arrived ABOVE the reader
    while they were scrolled, which waits behind the "N new posts" pill until
    they tap it (see `useNewPosts`). At the top it merges in place; the
    reader's own posts always show at once.
  */
  const me = useMe();
  const fresh = useNewPosts({
    items: loaded,
    laneKey: `${lane}:${topics.join(",")}`,
    meId: me.data?.id ?? null,
  });
  const items = fresh.shown;
  const listRef = useRef<HTMLDivElement>(null);
  const canLoadMore = Boolean(feed.hasNextPage);
  /* The shared sentinel every other paged list in the app uses — 600px of
     rootMargin, so the next page is asked for before the reader arrives. */
  const sentinelRef = useInfiniteScroll(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, canLoadMore);

  /**
   * What the full-screen viewer scrolls: every MEDIA post of the lane, photos
   * included, in lane order.
   *
   * Clips only would strand a reader who expanded a photo on a single slide
   * with nothing above or below it, and would skip past the photos of the lane
   * they were reading.
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
  useMarketView("feed_viewed", { surface: "market_square_home", source: topic ?? lane });

  return (
    <>
      {/* One timeline, every width. Mobile used to get a full-viewport snap
          feed instead, which is why a text post arrived as a sentence floating
          in a wall of black and why the phone never had the reading surface
          the desktop did. Video moved to Explore's reels, where it is watched
          rather than scrolled past. */}
      {/* The ground is `#0F0F0F` and belongs to the shell's pane, not to this
          column — see AppShell. Painting it here left a seam beside the right
          rail. */}
      {/* `ws-align-logo`: under the dock, from md up, the left gutter goes so
          the stories start on the top bar lockup's line — see globals.css. */}
      <div className="ws-align-logo relative px-4 py-4 lg:px-6">
        {/*
          HOME STARTS AT THE STORIES — node 225:3315.

          Three things used to sit above them and none is in the file:

          · a `Schedule Stream` / `Create Post` pair. Composing is already
            global — the shell's floating `+` opens the composer on every
            surface that allows one — so this was a second entry point for the
            same act, occupying the first thing a reader sees.
          · the HALLWAY, whose whole job is now done by the rooms carousel
            below the tab row (225:3822). It was drawing its own empty state,
            so a square with no room open opened on "No gist rooms open" — an
            apology, at the top of the home page, for a quiet evening. The
            carousel renders NOTHING when nothing is open, which is the same
            information and costs no space.
          · `Trending discussions`, which is real and stays, but below the
            stories rather than above them — see its own note.

          What the file opens on is the people you follow, which is what a
          social page should say first.
        */}
        {authenticated && (
          <div className="mb-4">
            <StoriesRow />
          </div>
        )}

        {/*
          What the square is talking about, on the overview where it belongs.
          It lives in the right rail, which is `hidden lg:block`, so without
          this the one thing the brief names as the point of the place was
          invisible to every reader on a phone.

          BELOW the stories now, not above: the file opens Home on the stories
          strip, and a section that is not in the design must not be the first
          thing anybody sees.
        */}
        <div className="mb-4 lg:hidden">
          <TrendingDiscussions limit={4} />
        </div>

        {/*
          The arena banner is gone from Home.

          It is a green, full-width call to join a LIVE ARENA — another
          product, in another slice, shouting on the one page that is supposed
          to say what this place is. Between it, the Live badge on the story
          rail and a "Live Streaming" lane, Home read as a broadcast product.
          It is not one: "we don't do all those streaming thing".

          It keeps its home on /live, which is where somebody who wants an
          arena goes.
        */}

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

        {/* NODE 225:3352 — the topic row, over its own 2px rule. */}
        <div className="mb-4">
          <TopicTabs
            tabs={tabs}
            active={topic}
            onSelect={(key) => setTopic(key)}
          />
        </div>

        {/* NODE 225:3822 — the rooms open right now, directly under the tabs.
            A room happening now beats a subject being discussed, and both beat
            a post from this morning. Renders nothing when none is open. */}
        {roomsSlot && <div className="mb-6">{roomsSlot}</div>}

        {/* NODES 225:3526 + 225:3374 — "Make some friends". */}
        {friendsSlot && <div className="mb-6">{friendsSlot}</div>}

        {/* 38 between cards, measured between the two slabs' outer edges in
            the Home frame (496:13048). It was 16, which read as a stack rather
            than as separate objects — and these are objects, not rows. */}
        {/* Floats over the column, fixed under the top bars, only while the
            reader is scrolled away from the head — at the top the held posts
            merge in place and there is nothing to announce. */}
        {fresh.pinned && (
          <NewPostsPill count={fresh.count} authors={fresh.authors} onTap={fresh.merge} column={listRef} />
        )}
        <div ref={listRef} className="space-y-4 md:space-y-[38px]">
          {feed.isPending && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}
          {feed.isError && (
            <ErrorState error={feed.error} fallback="Couldn't load the feed." onRetry={() => feed.refetch()} />
          )}
          {feed.isSuccess && items.length === 0 && (
            <EmptyState
              glyph="◇"
              title={topic ? "Nothing here yet" : EMPTY_COPY[lane].title}
              body={
                topic
                  ? "Nobody has posted under this topic yet. Try another, or start the conversation."
                  : EMPTY_COPY[lane].body
              }
              action={
                topic ? null : <LaneCta empty={EMPTY_COPY[lane]} authenticated={authenticated} />
              }
            />
          )}
          {items.map((item, index) => (
            <Fragment key={item.id}>
              <div className="ws-enter">
                <FeedItemCard
                  item={item}
                  followSlot={followSlot}
                  winkSlot={winkSlot}
                  onOpenMedia={openMedia}
                  tipSlot={tipSlot}
                  onQuote={(post) => {
                    setQuoting(post);
                    setComposerOpen(true);
                  }}
                />
              </div>
              {/*
                NODE 258:5545 — "Join a community", INSIDE the timeline rather
                than under it.

                It used to close the page, which only worked while the feed had
                a floor: a grid below a list that pages forever is a grid nobody
                reaches. One post above it puts it on the first screen, where
                somebody who has just seen what the square sounds like is being
                offered a room to say it in.

                Rendered against the LAST post when the feed is shorter than the
                cut, so a one-post lane still shows it rather than dropping it.
                It sits in the list's own 38 rhythm and carries no padding of
                its own.
              */}
              {communitySlot &&
                index === Math.min(BEFORE_COMMUNITY - 1, items.length - 1) && (
                  <div>{communitySlot}</div>
                )}
              {/* NODE 540:19351 — the pals rail, deeper into the timeline than
                  the community grid, and pinned to the LAST post when the feed
                  is shorter than the cut. A young square has three posts in it,
                  and a section that only exists once there are four would be
                  missing exactly when meeting people matters most. */}
              {palsSlot && index === Math.min(BEFORE_PALS - 1, items.length - 1) && (
                <div>{palsSlot}</div>
              )}
            </Fragment>
          ))}
        </div>

        {/*
          The end of the list asks for the next page itself — node 242:4890's
          "Load more" row is gone. The sentinel sits 600px ahead of the reader
          (`useInfiniteScroll`), so the next posts are usually already there by
          the time they arrive; the spinner is what shows when they are not.
        */}
        {canLoadMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
        {feed.isFetchingNextPage && (
          <div className="flex justify-center py-6">
            <Spinner className="h-4 w-4" />
          </div>
        )}
        {feed.isSuccess && !canLoadMore && items.length > 0 && (
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
