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

export const EXPLORE_TABS = [
  "for-you",
  "people",
  "posts",
  "shows",
  "streams",
  "products",
] as const;

export type ExploreTab = (typeof EXPLORE_TABS)[number];

export const EXPLORE_TAB_LABEL: Record<ExploreTab, string> = {
  "for-you": "For you",
  people: "People",
  posts: "Posts",
  shows: "Shows",
  streams: "Streams",
  products: "Products",
};

/** A chip in the URL must be one of ours; anything else falls back. */
export function parseExploreTab(raw: string | null): ExploreTab {
  return (EXPLORE_TABS as readonly string[]).includes(raw ?? "")
    ? (raw as ExploreTab)
    : "for-you";
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
 * inventing a fifth search type the service does not have. Every other chip
 * inherits the viewer's saved interests; with none, the answer is `[]`, which
 * means "no filter" and never "match nothing".
 */
export function exploreTabTopics(tab: ExploreTab, interests: string[]): string[] {
  return tab === "shows" ? ["shows"] : interests;
}

/**
 * Does this chip list anything without a search query?
 *
 * `For you`, `Shows` and `Streams` browse the media/stream grid, and `People`
 * browses the profile directory — all four list without a query, because a
 * discovery surface must be populated on arrival rather than asking the reader
 * to go and find something first.
 *
 * `Posts` and `Products` still have no browse listing wired, so with an empty
 * field they invite a search. They are not broken — `/search` is simply the
 * only route that answers them today.
 */
export function exploreTabBrowses(tab: ExploreTab): boolean {
  return tab === "for-you" || tab === "shows" || tab === "streams" || tab === "people";
}

/**
 * Does this chip render the PEOPLE directory rather than the card grid?
 *
 * People are rows, not cards, and they come from their own paged route — so
 * the tab renders a different list entirely, not a differently-filtered grid.
 */
export function exploreTabIsPeople(tab: ExploreTab): boolean {
  return tab === "people";
}

/**
 * Does the grid carry recorded videos for this chip, or live streams only?
 *
 * `Streams` is the live list by definition; the media tabs carry both.
 */
export function exploreTabShowsVideos(tab: ExploreTab): boolean {
  return tab === "for-you" || tab === "shows";
}
