"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { videoHref, type VideoItem } from "@/lib/video-context";
import { isVideoPost } from "@/lib/media";
import {
  exploreTabSearchType,
  exploreTabShowsVideos,
  exploreTabTopics,
  parseExploreTab,
  type ExploreTab,
} from "@/lib/explore-tabs";
import { useQueryParam } from "@/hooks/use-query-param";
import { DiscoveryPage, useDiscovery, useMyInterests, usePeople } from "@/features/discovery";
import type { ExploreItem } from "@/features/discovery";
import { videoMorphName } from "@/features/discovery";
import { useStreamList } from "@/features/streams";
import { PersonRow } from "@/features/profile";
import { useMe } from "@/hooks/use-me";
import { excludeViewer } from "@/lib/people-directory";
import { useMediaFeed, mediaPostsOf, videoPostsOf, VideoViewer } from "@/features/feed";
import { useBrowsePosts, postsOf, PostCard, PostLikePill } from "@/features/feed";
import { useStoreItems, StoreItemCard } from "@/features/store";

/**
 * Explore's cross-slice join.
 *
 * Three slices meet on this page and none of them may import the others:
 * discovery owns the search and the topic vocabulary, streams owns the live
 * list, feed owns the recorded videos and the immersive viewer. The screen is
 * where they are wired together — the same route-slot pattern `home-screen`
 * uses to put profile's follow control into the timeline.
 *
 * It also owns the SELECTION (query, filter, topic chip, open video), because
 * that one selection is what the grid, the search results and the viewer must
 * all agree on. The viewer's scroll list is literally the grid's query, so
 * scrolling past the loaded page fetches the next one exactly as the grid
 * would — see `lib/video-context.ts`.
 */
export function DiscoverScreen() {
  // The ?q= seed holds until the first keystroke, which hands the field over
  // to local state — no effect syncing two sources of truth.
  const seedQuery = useQueryParam("q");
  const seedTab = useQueryParam("tab");
  const seedVideo = useQueryParam("v");

  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? seedQuery ?? "";
  // ONE chip selection drives everything: which grid is browsed, which
  // `?type=` a search narrows to, and which topics apply. The mappings are
  // pure and live in `lib/explore-tabs.ts`.
  const [tab, setTab] = useState<ExploreTab>(() => parseExploreTab(seedTab));
  const [openVideoId, setOpenVideoId] = useState<string | null>(seedVideo);

  const deferredQuery = useDeferredValue(query);
  const hasQuery = deferredQuery.trim().length > 0;

  // `Shows` is a topic from the backend's own vocabulary; every other chip
  // inherits the viewer's saved interests. Neither means "no filter", never
  // "match nothing".
  const interests = useMyInterests();
  const topics = useMemo(
    () => exploreTabTopics(tab, interests.data?.topics ?? []),
    [tab, interests.data?.topics]
  );
  const searchType = exploreTabSearchType(tab);

  const live = useStreamList("live", topics);
  // `Streams` browses live broadcasts only — a stream tab that folded in
  // recorded clips would stop meaning "streams".
  const media = useMediaFeed(topics, !hasQuery && exploreTabShowsVideos(tab));
  const search = useDiscovery(deferredQuery, searchType, topics);
  // The People tab is its own paged directory, populated on arrival and
  // narrowed by the query — never a blank tab waiting to be searched.
  // Each browsing tab pages its own endpoint, and only the active one runs —
  // the others would be paying for a list nobody is looking at.
  const people = usePeople(tab === "people" ? deferredQuery : "", tab === "people");
  // `/feed` and `/store/items` take no `q`, so on those tabs a query falls
  // through to /search rather than narrowing this list. See the report.
  const browsePosts = useBrowsePosts(topics, tab === "posts" && !hasQuery);
  const storeItems = useStoreItems(undefined, tab === "products" && !hasQuery);

  /**
   * The directory, minus the viewer — you are not someone you can discover.
   *
   * TEMPORARY: this belongs on the server (`GET /profiles` excluding the
   * caller, requested). Filtering here costs a row per page that the cursor
   * cannot top up. Delete this and `lib/people-directory.ts` together once the
   * backend excludes you — see that module for why both layers must not
   * survive. `PersonRow`'s own-row guard is NOT part of this and stays: it
   * protects search results and followers lists, where you legitimately appear
   * and still must not be offered a Follow button on yourself.
   */
  const me = useMe();
  const directoryPeople = useMemo(
    () => excludeViewer(people.data?.pages.flatMap((page) => page.items) ?? [], me.data?.id),
    [people.data?.pages, me.data?.id]
  );

  // The grid: LIVE first — it is the only thing on the square that expires
  // while you look at it — then the recorded videos.
  const browseMedia = useMemo(() => mediaPostsOf(media.data?.pages), [media.data?.pages]);
  const browseVideos = useMemo(() => videoPostsOf(media.data?.pages), [media.data?.pages]);
  const gridItems: ExploreItem[] = useMemo(
    () => [
      ...(live.data?.items ?? []).map((stream) => ({ kind: "stream" as const, stream })),
      ...browseMedia.map((post) => ({ kind: "media" as const, post })),
    ],
    [live.data?.items, browseMedia]
  );

  /**
   * Keep paging until the grid is worth showing.
   *
   * `/feed` has no media filter, so a page of 30 mixed items can contain two
   * pictures and nothing else — and Explore is the surface people land on
   * before they have an account. An almost-empty grid there is the worst first
   * impression we can make, so a thin page asks for the next one rather than
   * waiting for the reader to scroll a grid that looks broken.
   */
  const GRID_TARGET = 12;
  useEffect(() => {
    if (hasQuery || !exploreTabShowsVideos(tab)) return;
    if (browseMedia.length >= GRID_TARGET) return;
    if (media.hasNextPage && !media.isFetchingNextPage) void media.fetchNextPage();
  }, [hasQuery, tab, browseMedia.length, media]);

  // The viewer's scroll list. In search it is the video subset of the SAME
  // result set the reader is looking at, paged by the same cursor.
  const searchVideos = useMemo(
    () =>
      (search.data?.pages ?? []).flatMap((page) =>
        page.items.flatMap((result) =>
          result.kind === "post" && isVideoPost(result.post) ? [result.post as VideoItem] : []
        )
      ),
    [search.data?.pages]
  );
  const viewerItems = hasQuery ? searchVideos : browseVideos;
  const pager = hasQuery ? search : media;

  // A deep link can name a video the loaded pages do not contain yet. Keep
  // asking for the next page while there is one, rather than dropping the
  // reader on an empty overlay.
  useEffect(() => {
    if (!openVideoId) return;
    if (viewerItems.some((item) => item.id === openVideoId)) return;
    if (pager.hasNextPage && !pager.isFetchingNextPage) void pager.fetchNextPage();
  }, [openVideoId, viewerItems, pager]);

  // The open video is in the URL, so it is shareable and a pasted link opens
  // straight into the viewer. `replaceState` rather than a route push: the
  // viewer is an overlay, and every swipe would otherwise stack a history
  // entry the back button has to chew through.
  const syncUrl = useCallback(
    (videoId: string | null) => {
      const href = videoId
        ? videoHref(videoId, { query: deferredQuery, tab }, window.location.pathname)
        : window.location.pathname;
      window.history.replaceState(null, "", href);
    },
    [deferredQuery, tab]
  );

  const open = (post: VideoItem) => {
    const apply = () => {
      flushSync(() => setOpenVideoId(post.id));
      syncUrl(post.id);
    };
    // The card morphs into the player. Feature-detected, and skipped under
    // reduced motion — the same rule the thumbnail → stream-room morph uses.
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }
    document.startViewTransition(apply);
  };

  const close = () => {
    const closedId = openVideoId;
    const apply = () => {
      flushSync(() => setOpenVideoId(null));
      syncUrl(null);
    };
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
    } else {
      document.startViewTransition(apply);
    }
    // The reader closes at whatever video they scrolled to, so the grid
    // returns to THAT card rather than to the top of the page.
    if (closedId) {
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-explore-card="${CSS.escape(closedId)}"]`)
          ?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
      });
    }
  };

  return (
    <>
      <DiscoveryPage
        query={query}
        onQueryChange={setTyped}
        deferredQuery={deferredQuery}
        tab={tab}
        onTabChange={setTab}
        search={search}
        people={{
          query: people,
          items: directoryPeople,
        }}
        posts={{ query: browsePosts, items: postsOf(browsePosts.data?.pages) }}
        products={{
          query: storeItems,
          items: storeItems.data?.pages.flatMap((page) => page.items) ?? [],
        }}
        gridItems={gridItems}
        gridPending={!hasQuery && (live.isPending || media.isPending)}
        onOpenVideo={open}
        openVideoId={openVideoId}
        renderPerson={(profile) => <PersonRow key={profile.id} profile={profile} />}
        renderPost={(post) => <PostCard key={post.id} post={post} />}
        renderProduct={(item) => <StoreItemCard key={item.id} item={item} />}
        renderLike={(post) => <PostLikePill post={post} />}
      />

      {openVideoId && (
        <VideoViewer
          items={viewerItems}
          activeId={openVideoId}
          onActiveChange={(id) => {
            setOpenVideoId(id);
            syncUrl(id);
          }}
          onClose={close}
          hasNextPage={Boolean(pager.hasNextPage)}
          isFetchingNextPage={pager.isFetchingNextPage}
          fetchNextPage={() => void pager.fetchNextPage()}
          morphNameFor={videoMorphName}
        />
      )}
    </>
  );
}
