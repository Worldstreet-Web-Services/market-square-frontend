/**
 * Explore's chip row.
 *
 * One row sits under the search field and nothing else: `Add +` then the
 * tabs. `Add +` is not a tab — it opens the topic picker — so it is
 * deliberately absent from this list and rendered separately.
 *
 * The row does double duty, and that is the whole reason this mapping is a
 * pure module rather than inline ternaries: a chip has to mean something both
 * while browsing (what the grid lists) and while searching (which `type` the
 * query is narrowed to). Those two answers are different functions of the same
 * chip, and both are pinned by tests.
 */

/*
  No "posts" tab. It rendered the endless vertical scroll — a reel by another
  name — and reels are gone by product decision: the shape of a video product
  competes with the thing this one is for, which is talking to people.

  Media did not go with it. It is browsable in the For you grid, and a person's
  own media lives on their profile, which is where you go to see what somebody
  has posted.
*/

/*
  PEOPLE LEADS, and it is the resting state.

  Removing the reel took the wrong shape off this surface; it did not answer
  what the surface is FOR. Explore still opened on `for-you`, a grid of
  pictures and clips, with people filed second — which reads as "here is some
  media, and also there are people". The square is a place you go to find
  PEOPLE. So the directory is what an unparameterised visit lands on, and the
  media grid is a chip you choose.

  Everything else keeps its place. `For you`, `Shows`, `Streams` and
  `Products` are each a destination somebody arrives already looking for, and
  none of them is a feed to fall into.
*/
export const EXPLORE_TABS = [
  "people",
  "for-you",
  "shows",
  "streams",
  "products",
] as const;

export type ExploreTab = (typeof EXPLORE_TABS)[number];

export const EXPLORE_TAB_LABEL: Record<ExploreTab, string> = {
  people: "People",
  "for-you": "For you",
  shows: "Shows",
  streams: "Streams",
  products: "Products",
};

/**
 * A chip in the URL must be one of ours; anything else falls back.
 *
 * The fallback is `people`, which is also what a bare /discover lands on. It
 * doubles as the landing for `?tab=posts` links shared before the reel was
 * removed: the surface they named is gone, so the reader gets what Explore is
 * now for rather than a blank page.
 */
export function parseExploreTab(raw: string | null): ExploreTab {
  return (EXPLORE_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as ExploreTab)
    : "people";
}

/**
 * Which `?type=` the chip narrows a SEARCH to.
 *
 * `For you` and `Shows` are not result kinds — they are "everything", and
 * `Shows` additionally narrows by topic (see `exploreTabTopics`). Mapping them
 * to a type would silently drop three quarters of the matches.
 */
export function exploreTabSearchType(tab: ExploreTab): string {
  switch (tab) {
    case "for-you":
    case "shows":
      return "all";
    default:
      return tab;
  }
}

/**
 * Which topics the chip filters by.
 *
 * `Shows` is a TOPIC, not a result kind — `shows` is in the backend's own
 * vocabulary from `GET /topics`, so the chip filters by it rather than
 * inventing a fifth search type the service does not have.
 *
 * EVERY OTHER CHIP FILTERS BY NOTHING, and the viewer's saved interests are
 * deliberately not consulted here. `topics=` is a hard filter — the service
 * documents it as "FILTERS to content carrying ANY of them" and says in the
 * same breath that interests are "distinct ... they BOOST for-you ordering
 * rather than filtering it". The for-you ranker already applies them, at
 * +2_500 per match, explicitly as a boost so "an interested viewer still sees
 * everything else, just lower".
 *
 * Passing them here turned that boost into a filter and applied it twice: a
 * viewer who picked two interests at onboarding saw an Explore grid with every
 * untagged post — and every post tagged anything else — removed outright,
 * while a viewer who picked none saw the whole square. Discovery that narrows
 * as you tell it more about yourself is backwards.
 *
 * A topic the reader picks by hand is a different thing and still filters;
 * that selection arrives through the picker, not through this function.
 */
export function exploreTabTopics(tab: ExploreTab): string[] {
  return tab === "shows" ? ["shows"] : [];
}

/**
 * Does this chip render a ROW LIST rather than the card grid?
 *
 * People, Posts and Products are rows from their own paged routes, so those
 * tabs render a different list entirely — not a differently-filtered grid.
 */
export function exploreTabIsRowList(tab: ExploreTab): boolean {
  return tab === "people" || tab === "products";
}

/**
 * Does the grid carry recorded videos for this chip, or live streams only?
 *
 * `Streams` is the live list by definition; the media tabs carry both.
 */
export function exploreTabShowsVideos(tab: ExploreTab): boolean {
  return tab === "for-you" || tab === "shows";
}
