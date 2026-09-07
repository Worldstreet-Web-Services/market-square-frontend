"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryParam } from "@/hooks/use-query-param";
import { useComposePrefill } from "@/hooks/use-compose-prefill";
import { useFeed } from "@/features/feed/hooks/use-feed";
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
import { IconLoadMore } from "@/components/ui/home-icons";

/** The file draws three posts before "Load more" (229:4113). */
const FIRST_PAGE = 3;
/** What one press reveals. The file cannot say; three matches what it shows. */
const STEP = 3;

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
    HOME SHOWS THREE POSTS AND A "LOAD MORE" — nodes 229:4113 and 242:4890.

    The file draws exactly three, then an `ep:refresh-left` row reading "Load
    more", then "Join a community". That last part is why this matters and is
    not a mockup convenience: with an infinitely scrolling timeline the
    community grid sits below content that never ends, so it could never be
    reached. An explicit control puts a floor under the feed and makes
    everything after it reachable on the first screen.

    It also matches what this product is. Home is an OVERVIEW — the rooms open
    now, people to meet, a taste of the conversation, communities to join — not
    an endless scroll. The endless scroll is Ark's.

    STEP is the one number worth arguing about and the file cannot settle it:
    three is what it draws, so three is what a press reveals. Change `STEP`
    alone to make it bigger.
  */
  const [shown, setShown] = useState(FIRST_PAGE);
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

  const loaded = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data?.pages]
  );
  const items = useMemo(() => loaded.slice(0, shown), [loaded, shown]);
  /* More to reveal from what is already here, or another page to ask for. */
  const canLoadMore = shown < loaded.length || Boolean(feed.hasNextPage);
  const loadMore = () => {
    setShown((current) => current + STEP);
    // Fetch ahead only when the reveal is about to run past what we hold — a
    // press should never leave the reader looking at the same three posts.
    if (shown + STEP > loaded.length && feed.hasNextPage && !feed.isFetchingNextPage) {
      void feed.fetchNextPage();
    }
  };

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
      <div className="relative px-4 py-4 lg:px-6">
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
            // Choosing a topic starts a NEW list, so the reveal goes back to
            // the first three. Reset in the handler rather than derived during
            // render — a ref read while rendering is exactly the pattern that
            // stops a component updating when you expect it to.
            onSelect={(key) => {
              setTopic(key);
              setShown(FIRST_PAGE);
            }}
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
        <div className="space-y-4 md:space-y-[38px]">
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
          {items.map((item) => (
            <div key={item.id} className="ws-enter">
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
          ))}
        </div>

        {/*
          NODE 242:4890 — a 16px `ep:refresh-left` glyph, an 8px gap, and
          "Load more" at 12/16 in 60% white.

          CENTRED. The node is a hug-width row, which reads as left-aligned
          until you measure it: it sits at x=6244 and is 82 wide, so its centre
          is 6285 against the feed block's 6268.5 — sixteen pixels off dead
          centre, which is a hand-nudge rather than an alignment. A control that
          ends a list belongs in the middle of it, the same place "You're all
          caught up" already sits.
        */}
        {canLoadMore && (
          <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={feed.isFetchingNextPage}
            className="ws-press flex items-center gap-2 text-[12px] leading-4 text-white/60 transition-colors hover:text-white disabled:opacity-50"
          >
            {feed.isFetchingNextPage ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <IconLoadMore className="h-4 w-4" />
            )}
            Load more
          </button>
          </div>
        )}
        {feed.isSuccess && !canLoadMore && items.length > 0 && (
          <p className="py-8 text-center text-sm text-meta">You&apos;re all caught up.</p>
        )}

        {/* NODE 258:5545 — "Join a community" closes the page. It is the last
            thing the file draws, and it is the right last thing: somebody who
            reached the bottom of the timeline has run out of the square they
            are in, and the answer is another one. Renders nothing until the
            directory route exists. */}
        {communitySlot && <div className="pt-2">{communitySlot}</div>}

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
