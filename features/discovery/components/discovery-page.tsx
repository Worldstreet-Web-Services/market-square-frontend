"use client";

import { useState } from "react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { errorCode } from "@/lib/api/envelope";
import { relativeTime } from "@/lib/format";
import { isVideoPost } from "@/lib/media";
import type { VideoItem } from "@/lib/video-context";
import type { Profile } from "@/lib/api/schemas";
import type { StoreItem } from "@/features/store/lib/types";

/**
 * A paged browse list, handed in by the screen.
 *
 * Explore reaches across four slices and none may import the others, so each
 * tab's query and its row renderer both arrive from `discover-screen`.
 */
export interface BrowseQuery<T> {
  query: React.ComponentProps<typeof BrowseList<T>>["query"];
  items: T[];
}
import { Avatar } from "@/components/ui/avatar";
import { Pill, VerifiedBadge } from "@/components/ui/badge";
import { GradientThumb } from "@/components/ui/gradient-thumb";
import { IconSearch } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/button";
import { RowSkeleton } from "@/components/ui/skeleton";
import { BrowseList } from "@/components/ui/browse-list";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useDiscovery } from "@/features/discovery/hooks/use-discovery";
import { ExploreGrid, type ExploreItem } from "@/features/discovery/components/explore-grid";
import { TopicPicker } from "@/components/ui/topic-picker";
import type { DiscoveryResult } from "@/features/discovery/lib/types";
import {
  EXPLORE_TABS,
  EXPLORE_TAB_LABEL,
  exploreTabIsRowList,
  type ExploreTab,
} from "@/lib/explore-tabs";

const ROW = "ws-row flex items-start gap-3 px-4 py-3";

/**
 * One search result, rendered from its own payload.
 *
 * Results are mixed, so each kind gets the shape that suits it rather than a
 * flattened title/subtitle row: a person reads as an identity line with their
 * badges, a post as its text, a stream and a product as their artwork.
 */
function ResultRow({
  result,
  onOpenVideo,
  renderPerson,
}: {
  result: DiscoveryResult;
  onOpenVideo: (post: VideoItem) => void;
  renderPerson: (profile: Profile) => React.ReactNode;
}) {
  if (result.kind === "profile") {
    // People rows are the profile slice's `PersonRow` — avatar, identity
    // chips, and a real follow control with optimistic rollback. It is
    // injected from `discover-screen` because slices never import each other,
    // and it is the SAME component every other people list uses.
    return renderPerson(result.profile);
  }

  if (result.kind === "post") {
    const post = result.post;
    const author = post.author;
    const identity = (
      <>
        <Avatar name={author?.displayName ?? "?"} seed={author?.id} src={author?.avatarUrl} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span className="truncate text-[15px] font-bold text-heading">
              {author?.displayName ?? "Market update"}
            </span>
            {author && (
              <VerifiedBadge verification={author.verification} className="h-3.5 w-3.5" />
            )}
            {post.createdAt && (
              <span className="text-[13px] text-meta">· {relativeTime(post.createdAt)}</span>
            )}
          </span>
          <span className="mt-0.5 line-clamp-3 block text-[14px] leading-normal text-body">
            {post.text}
          </span>
        </span>
      </>
    );

    // A VIDEO result opens the immersive viewer over the SEARCH result set —
    // scrolling then moves through the other videos this query matched, not
    // through an unrelated list. Everything else still opens the permalink.
    if (isVideoPost(post)) {
      return (
        <button
          type="button"
          onClick={() => onOpenVideo(post)}
          className={cn(ROW, "w-full text-left")}
          aria-label={post.text ? `Play video: ${post.text}` : "Play video"}
        >
          {identity}
        </button>
      );
    }

    return (
      // A post result opens the POST, never its author — and never falls back
      // to the home timeline when the payload carries no author.
      <Link href={`/p/${post.id}`} className={ROW}>
        {identity}
      </Link>
    );
  }

  if (result.kind === "stream") {
    const stream = result.stream;
    return (
      <Link href={`/live/${stream.id}`} className={ROW}>
        <GradientThumb seed={stream.id} className="h-11 w-16 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold text-heading">{stream.title}</span>
            {stream.status && <Pill>{stream.status}</Pill>}
          </span>
          <span className="block truncate text-[13px] text-meta">
            {[stream.owner?.displayName, stream.category].filter(Boolean).join(" · ") ||
              "Live stream"}
          </span>
        </span>
      </Link>
    );
  }

  const product = result.product;
  return (
    <Link href={`/store/${product.slug}`} className={ROW}>
      <GradientThumb seed={product.id} className="h-11 w-11 shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-bold text-heading">{product.name}</span>
          {product.pricing && <Pill>{product.pricing === "free" ? "Free" : "KASH"}</Pill>}
        </span>
        {product.tagline && (
          <span className="block truncate text-[13px] text-meta">{product.tagline}</span>
        )}
      </span>
    </Link>
  );
}

/**
 * A browsing tab that is not the card grid.
 *
 * People, Posts and Products are ROWS from their own paged routes, so the tab
 * renders a different list entirely rather than a differently-filtered grid.
 * All three share `BrowseList` — see its header for why the shell is
 * abstracted and the queries deliberately are not.
 */
function BrowseTab({
  tab,
  people,
  postsSlot,
  products,
  renderPerson,
  renderProduct,
}: {
  tab: ExploreTab;
  people: BrowseQuery<Profile>;
  /** The reels surface, composed by the route. */
  postsSlot: React.ReactNode;
  products: BrowseQuery<StoreItem>;
  renderPerson: (profile: Profile) => React.ReactNode;
  renderProduct: (item: StoreItem) => React.ReactNode;
}) {
  if (tab === "people") {
    return (
      <BrowseList
        query={people.query}
        items={people.items}
        renderItem={renderPerson}
        emptyTitle="Nobody to show yet"
        emptyBody="Check back shortly."
        errorFallback="Couldn't load people."
      />
    );
  }

  // Posts is REELS: one video per screen, vertical snap, no ending. It owns
  // its whole scroll container rather than rendering rows, so the route
  // composes the surface in instead of a per-item renderer.
  if (tab === "posts") return <>{postsSlot}</>;

  return (
    <div className="space-y-4 p-4">
      <BrowseList
        query={products.query}
        items={products.items}
        renderItem={renderProduct}
        emptyTitle="No products yet"
        emptyBody="The ARK Store is still filling up."
        errorFallback="Couldn't load products."
      />
    </div>
  );
}

// Kinds are interleaved, so a key must carry the kind as well as the id.
const resultKey = (result: DiscoveryResult) => `${result.kind}-${result.id}`;

/**
 * Explore.
 *
 * The page IS the design: the search field, ONE chip row, and the card grid.
 * It used to open with a helper line and a hand-written list of other
 * surfaces to visit ("Home feed / Live / ARK Store / Citizen Spotlight") —
 * interim scaffolding from before the grid existed, which sat above the design
 * and pushed it below the fold. Both are gone; do not reintroduce them.
 *
 * Search state is CONTROLLED from `discover-screen`, because the grid, the
 * search results and the immersive viewer all read one selection and the
 * viewer lives in another slice. The screen owns that join.
 */
export function DiscoveryPage({
  query,
  onQueryChange,
  deferredQuery,
  tab,
  onTabChange,
  search,
  people,
  postsSlot,
  products,
  gridItems,
  gridPending,
  onOpenVideo,
  openVideoId,
  renderPerson,
  renderProduct,
  spotlightSlot,
  renderLike,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  /** The debounced query the results actually correspond to. */
  deferredQuery: string;
  /** The one chip selection: what the grid browses AND how a search narrows. */
  tab: ExploreTab;
  onTabChange: (tab: ExploreTab) => void;
  search: ReturnType<typeof useDiscovery>;
  /** The People directory — its own paged route, narrowed by the query. */
  people: BrowseQuery<Profile>;
  /** The Posts tab, which is the reels surface. */
  postsSlot: React.ReactNode;
  /** The Products tab — the ARK Store's paged item list. */
  products: BrowseQuery<StoreItem>;
  gridItems: ExploreItem[];
  gridPending: boolean;
  onOpenVideo: (post: VideoItem) => void;
  openVideoId: string | null;
  /** Row renderers, supplied by the screen from each owning slice. */
  renderPerson: (profile: Profile) => React.ReactNode;
  renderProduct: (item: StoreItem) => React.ReactNode;
  /**
   * Citizen Spotlight, composed by the route. On desktop it lives in the right
   * rail; that rail is `lg:block`, so below lg it had nowhere to be at all and
   * the surface was unreachable without typing the URL.
   */
  spotlightSlot?: React.ReactNode;
  /** The card like control, from the feed slice. */
  renderLike: (post: VideoItem) => React.ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const sentinel = useInfiniteScroll(
    () => search.fetchNextPage(),
    Boolean(search.hasNextPage && !search.isFetchingNextPage)
  );

  // 404 means the route is not deployed, not that the query failed.
  const unavailable = errorCode(search.error) === "NOT_FOUND";
  const items = search.data?.pages.flatMap((page) => page.items) ?? [];
  const hasQuery = deferredQuery.trim().length > 0;
  // People, Posts and Products are row lists from their own routes; every
  // other browsing tab is the media/stream grid.
  const isBrowseTab = exploreTabIsRowList(tab);
  // Every page reports the same filter, so the first one answers for all.
  const topicFilter = search.data?.pages[0]?.topicFilter ?? null;
  const excluded = topicFilter?.excluded ?? [];
  const excludedLabel =
    topicFilter && topicFilter.topics.length > 0 && excluded.length > 0
      ? new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(excluded)
      : null;

  return (
    <>
      <header className="ws-head sticky top-0 z-30">
        <div className="px-4 py-2.5">
          <label className="ws-field flex h-11 items-center gap-3 px-4">
            <IconSearch className="h-5 w-5 shrink-0 text-meta" />
            <span className="sr-only">Search Market Square</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search people, posts, streams, products…"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none"
            />
          </label>
        </div>
        {/*
          ONE row under the field and nothing else. It is both the browse
          selector and the search filter — see `lib/explore-tabs.ts` for the
          two mappings, which are pure and tested.

          Type is ONE treatment across every state: the design dump gives the
          active chip Geist 500 16px/22px and every inactive chip Roboto 700
          12px/16px, which would change family AND size on selection and make
          the whole row reflow as the reader taps along it — chips visibly
          resizing under the finger. State is carried by COLOUR alone
          (40% white → pure white). Flagged for the designer; if the size
          change is intended it is a one-line revert. Roboto is also not a
          house face — the app is Geist throughout — so this renders at the
          specified weight and size in the house font, as the topic picker
          already does with chips from the same dump.
        */}
        <div
          className="flex gap-3 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Explore"
        >
          {/*
            `Add +` opens the topic picker rather than selecting anything, so
            it is not one of the tabs. That is also why this row is NOT a
            `role="tablist"`: a tablist whose children are not all tabs is a
            broken ARIA contract, and `role="tab"` further promises a
            `tabpanel` that does not exist here. `aria-current` states the
            selection honestly, which is what the lane tabs elsewhere use.
          */}
          <button
            onClick={() => setPickerOpen(true)}
            className="ws-press flex h-[38px] w-[101px] shrink-0 items-center justify-center gap-1 rounded-full text-[12px] font-bold leading-4 text-[#F4F4F4]"
            style={{ background: "linear-gradient(90deg, #9F65FD 0%, #5B05E6 100%)" }}
          >
            Add <span aria-hidden>+</span>
          </button>

          {EXPLORE_TABS.map((entry) => (
            <button
              key={entry}
              onClick={() => onTabChange(entry)}
              aria-current={tab === entry ? "true" : undefined}
              className={cn(
                // Sized to content, not the Add chip's fixed 101px: seven
                // 101px chips make a ~730px row inside a 600px column, so the
                // set would scroll sideways with the last tabs off-screen for
                // no reason. The Add chip keeps the spec's fixed pill.
                "ws-press h-[38px] shrink-0 rounded-full px-3 text-[12px] font-bold leading-4 transition-colors",
                // No fill on either state — the design draws these transparent.
                tab === entry ? "text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              {EXPLORE_TAB_LABEL[entry]}
            </button>
          ))}
        </div>
      </header>

      {/* Search has no endpoint on some deployments: the query 404s. That is a
          deployment gap, not a fault, so the page says so plainly. */}
      {!isBrowseTab && unavailable && (
        <div className="p-4">
          <EmptyState
            glyph="⌕"
            title="Search isn't available yet"
            body="This turns on by itself once the service ships it."
          />
        </div>
      )}

      {/*
        PEOPLE is its own list, and it replaces both the grid and the search
        results: profiles are rows from their own paged route, and the query
        narrows that SAME list rather than switching to /search — one list, one
        cursor, instead of two that page differently.
      */}
      {isBrowseTab && (
        <BrowseTab
          tab={tab}
          people={people}
          postsSlot={postsSlot}
          products={products}
          renderPerson={renderPerson}
          renderProduct={renderProduct}
        />
      )}

      {/* Citizen Spotlight, on the surface people actually browse. It sits in
          the right rail from lg up, and that rail does not exist below it —
          so on a phone this is the only place it can be seen. Hidden at lg to
          avoid showing it twice on one screen. */}
      {!hasQuery && spotlightSlot && (
        <div className="px-4 pb-4 lg:hidden">{spotlightSlot}</div>
      )}

      {/* Resting Explore: the card grid. A search replaces it with results. */}
      {!isBrowseTab && !hasQuery && !unavailable && (
        <div className="space-y-4 px-4 pb-4">
          {gridPending && (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6 text-meta" />
            </div>
          )}

          <ExploreGrid
            items={gridItems}
            onOpenVideo={onOpenVideo}
            openVideoId={openVideoId}
            renderLike={renderLike}
          />

          {!gridPending && gridItems.length === 0 && (
            <EmptyState
              glyph="◇"
              title="Nothing here yet"
              body={
                tab === "streams"
                  ? "No live broadcasts right now."
                  : "No live streams, pictures or videos under this selection right now."
              }
            />
          )}
        </div>
      )}

      {!isBrowseTab && hasQuery && search.isPending && [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}

      {!isBrowseTab && search.isError && !unavailable && (
        <div className="p-4">
          <ErrorState
            error={search.error}
            fallback="Couldn't search the square."
            onRetry={() => search.refetch()}
          />
        </div>
      )}

      {!isBrowseTab && hasQuery && search.isSuccess && items.length === 0 && (
        <div className="p-4">
          <EmptyState
            glyph="⌕"
            title={`No matches for “${deferredQuery.trim()}”`}
            body={
              tab === "for-you"
                ? "Try a different name or word."
                : `Nothing in ${EXPLORE_TAB_LABEL[tab]}. Try For you instead.`
            }
            action={
              tab !== "for-you" ? (
                <button
                  onClick={() => onTabChange("for-you")}
                  className="ws-press rounded-full border border-white/20 px-4 py-1.5 text-[13px] font-bold text-body transition-colors hover:bg-white/10"
                >
                  Search everything
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {/*
        The service tells us what the topic filter did NOT apply to, and people
        are the case that matters: a person is not filed under a topic, so they
        are excluded rather than returned empty. Without saying so, a reader who
        filtered by a topic and saw no creators would conclude there were none.
        Rendered only when a filter was actually applied and something really
        was excluded — never as standing furniture.
      */}
      {!isBrowseTab && hasQuery && excludedLabel && (
        <p className="px-4 py-3 text-[13px] text-meta">
          Topic filters don&apos;t apply to {excludedLabel} — those results aren&apos;t
          narrowed by {topicFilter!.topics.join(", ")}.
        </p>
      )}

      {!isBrowseTab &&
        hasQuery &&
        items.map((result) => (
          <ResultRow
            key={resultKey(result)}
            result={result}
            onOpenVideo={onOpenVideo}
            renderPerson={renderPerson}
          />
        ))}

      <TopicPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      {/* Results page with the service's cursor — they used to stop dead at
          the first response's 30 matches. */}
      <div ref={sentinel} />
      {search.isFetchingNextPage && (
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6 text-meta" />
        </div>
      )}
    </>
  );
}
