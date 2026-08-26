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
 * Does this chip render a ROW LIST rather than the card grid?
 *
 * People, Posts and Products are rows from their own paged routes, so those
 * tabs render a different list entirely — not a differently-filtered grid.
 */
export function exploreTabIsRowList(tab: ExploreTab): boolean {
  return tab === "people" || tab === "posts" || tab === "products";
}

/**
 * Does the grid carry recorded videos for this chip, or live streams only?
 *
 * `Streams` is the live list by definition; the media tabs carry both.
 */
export function exploreTabShowsVideos(tab: ExploreTab): boolean {
  return tab === "for-you" || tab === "shows";
}
