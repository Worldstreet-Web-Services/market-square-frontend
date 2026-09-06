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
import {
  EMPTY_PEOPLE_FILTER,
  filterPeople,
  parsePeopleSort,
  type PeopleFilter,
  type PeopleSort,
} from "@/lib/people-filters";
import { EcosystemPartnersRail } from "@/components/layout/ecosystem-partners-rail";
import {
  DiscoveryPage,
  ExploreCategoriesRail,
  PeopleFilters,
  useDiscovery,
  usePeople,
} from "@/features/discovery";
import type { ExploreItem } from "@/features/discovery";
import { videoMorphName } from "@/features/discovery";
import { useStreamList } from "@/features/streams";
import { CitizenSpotlightRail, PersonRow } from "@/features/profile";
import { useMe } from "@/hooks/use-me";
import { excludeViewer } from "@/lib/people-directory";
import { useMediaFeed, mediaPostsOf, videoPostsOf, VideoViewer } from "@/features/feed";
import { PostLikePill } from "@/features/feed";
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
  const seedSort = useQueryParam("sort");

  const [typed, setTyped] = useState<string | null>(null);
  const query = typed ?? seedQuery ?? "";
  // ONE chip selection drives everything: which grid is browsed, which
  // `?type=` a search narrows to, and which topics apply. The mappings are
  // pure and live in `lib/explore-tabs.ts`.
  const [tab, setTab] = useState<ExploreTab>(() => parseExploreTab(seedTab));
  const [openVideoId, setOpenVideoId] = useState<string | null>(seedVideo);
  /*
    The people selection, split by WHERE IT IS ANSWERED and not by how it looks.

    `sort` is a request parameter, so it lives in the query key and a change
    starts a new paged list from the service in that order — a client-side
    re-sort of one loaded page would make page 1 look ordered while page 2
    contradicted it.

    `filter` is matched over the pages already loaded, because `GET /profiles`
    accepts no facet parameters at all. That is a stopgap and it is labelled as
    one on the surface itself; `lib/people-filters.ts` carries the contract
    check and the exact list of what the backend still owes.

    Both seed from the URL so a filtered directory is a link somebody can send.
  */
  const [peopleSort, setPeopleSort] = useState<PeopleSort>(() => parsePeopleSort(seedSort));
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>(EMPTY_PEOPLE_FILTER);

  const deferredQuery = useDeferredValue(query);
  const hasQuery = deferredQuery.trim().length > 0;

  // `Shows` is a topic from the backend's own vocabulary; every other chip
  // sends no topic filter at all. The viewer's saved interests are NOT fed in
  // here — the for-you ranker already applies them upstream as a boost, and
  // `topics=` is a hard filter, so passing them narrowed Explore instead of
  // ordering it. See `exploreTabTopics`.
  const topics = useMemo(() => exploreTabTopics(tab), [tab]);
  const searchType = exploreTabSearchType(tab);

  const live = useStreamList("live", topics);
  // `Streams` browses live broadcasts only — a stream tab that folded in
  // recorded clips would stop meaning "streams".
  // The grid's media. The Posts tab used to feed from this too — it was the
  // endless reel — and went with the rest of them.
  const media = useMediaFeed(topics, !hasQuery && exploreTabShowsVideos(tab));
  const search = useDiscovery(deferredQuery, searchType, topics);
  // The People tab is its own paged directory, populated on arrival and
  // narrowed by the query — never a blank tab waiting to be searched.
  // Each browsing tab pages its own endpoint, and only the active one runs —
  // the others would be paying for a list nobody is looking at.
  const people = usePeople(
    tab === "people" ? deferredQuery : "",
    peopleSort,
    tab === "people",
    /*
      PLACE AND GENDER GO TO THE SERVICE NOW.

      `GET /profiles` takes `city`, `region` and `gender` — case-insensitive,
      exact, composing with each other and with `q` — so the directory is
      narrowed where it lives instead of on the thirty rows that happened to be
      loaded. That stopgap could never work: a filtered page came back short and
      its cursor topped it up with rows that were then filtered away too, so
      picking a city produced a stub list and a scroll that went nowhere.

      One free-text box feeds BOTH place parameters, because the reader types a
      place and does not know whether we file it as a city or a region. The
      service matches either.
    */
    {
      city: peopleFilter.location,
      region: peopleFilter.location,
      gender: peopleFilter.gender,
    }
  );
  // `/feed` and `/store/items` take no `q`, so on those tabs a query falls
  // through to /search rather than narrowing this list. See the report.
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
  const loadedPeople = useMemo(
    () => excludeViewer(people.data?.pages.flatMap((page) => page.items) ?? [], me.data?.id),
    [people.data?.pages, me.data?.id]
  );
  /*
    ROLE AND VERIFICATION are still applied here, and only those two.

    They are on every row by contract and the service takes no parameter for
    either, so narrowing the loaded page is the only place they can be applied
    — and it is honest for them in a way it never was for place: a role is
    carried by every profile, so a filtered page is short but not WRONG, and
    paging tops it up with more rows that also carry it.

    Place and gender have moved to the service (see `usePeople` above) and are
    deliberately NOT re-applied here. Doing both would be the "two layers doing
    one job" that makes the server-side filter unverifiable — if this ever
    starts hiding a row the service returned, that is a bug in the service worth
    seeing rather than papering over.

    Kept SEPARATE from `loadedPeople` on purpose: the filter bar reads the
    unfiltered rows to decide which facets the payload can even answer
    (`facetAvailability`), and feeding it the filtered list would make a control
    vanish the moment it excluded everything that carried the field it was
    filtering on.
  */
  const directoryPeople = useMemo(
    () => filterPeople(loadedPeople, { ...peopleFilter, location: "", gender: "" }),
    [loadedPeople, peopleFilter]
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
        peopleFiltersSlot={
          <PeopleFilters
            /* The UNFILTERED rows — see the note on `directoryPeople`. */
            people={loadedPeople}
            filter={peopleFilter}
            onFilterChange={setPeopleFilter}
            sort={peopleSort}
            onSortChange={setPeopleSort}
          />
        }
        products={{
          query: storeItems,
          items: storeItems.data?.pages.flatMap((page) => page.items) ?? [],
        }}
        gridItems={gridItems}
        gridPending={!hasQuery && (live.isPending || media.isPending)}
        onOpenVideo={open}
        openVideoId={openVideoId}
        renderPerson={(profile) => <PersonRow key={profile.id} profile={profile} />}
        spotlightSlot={<CitizenSpotlightRail />}
        promoSlot={<EcosystemPartnersRail />}
        railSlot={<ExploreCategoriesRail />}
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
