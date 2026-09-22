import { msApi } from "@/lib/api/service";
import { parsePeopleSort, type PeopleSort } from "@/lib/people-filters";
import {
  CategoryListSchema,
  PeoplePageSchema,
  DiscoverySchema,
  InterestsSchema,
  TopicListSchema,
} from "@/features/discovery/lib/types";

// `limit` is a page size, not a ceiling: the caller pages with `nextCursor`
// rather than stopping at the first 30 matches.
export async function searchMarket(
  query: string,
  type: string,
  cursor?: string,
  topics: string[] = []
) {
  return DiscoverySchema.parse(
    await msApi.get("/search", {
      q: query.trim(),
      type,
      limit: 30,
      cursor,
      // Comma-joined, and omitted entirely when nothing is chosen — an empty
      // `topics=` would read as "match no topics" rather than "no filter".
      ...(topics.length > 0 ? { topics: topics.join(",") } : {}),
    })
  );
}

export async function fetchCategories() {
  return CategoryListSchema.parse(await msApi.get("/categories"));
}

/**
 * Where a topic list is shown. `GET /topics?surface=` answers each surface its
 * OWN chips in its own order — Home's row is eight, a house's tag field is the
 * eleven — and no surface is every topic, for pickers and label lookups.
 */
export type TopicSurface = "home" | "composer";

export async function fetchTopics(surface?: TopicSurface) {
  return TopicListSchema.parse(await msApi.get("/topics", surface ? { surface } : undefined));
}

export async function fetchMyInterests() {
  return InterestsSchema.parse(await msApi.authedGet("/me/interests"));
}

export async function saveMyInterests(topics: string[]) {
  return InterestsSchema.parse(await msApi.put("/me/interests", { topics }));
}

/**
 * The people directory — see `PeoplePageSchema` for why this route is
 * provisional and what it replaces.
 *
 * `sort` asks for the ordering that makes a directory useful for DISCOVERY:
 * most-followed first, so arriving on the tab shows the people worth finding
 * rather than whoever happens to have been inserted first. The backend is free
 * to ignore an unknown parameter; the client never re-sorts a paged list
 * itself, since sorting one loaded page is not sorting the list.
 */
export async function fetchPeople(
  params: {
    query?: string;
    sort?: PeopleSort;
    cursor?: string;
    /**
     * The place and gender facets, matched SERVER-SIDE.
     *
     * `city`, `region` and `gender` are real parameters on `GET /profiles` now,
     * case-insensitive and exact (`lagos` matches `Lagos`, `Lag` matches
     * nothing). They compose with each other and with `q`.
     *
     * This replaces filtering the loaded page, which was always a stopgap and
     * said so: narrowing thirty rows of a directory is not narrowing the
     * directory, and no cursor can top a filtered page back up — a reader who
     * picked a city got one short page and an empty scroll.
     *
     * There is deliberately NO coordinate, radius or distance here, and there
     * must never be one. See `lib/people-filters.ts`.
     */
    city?: string;
    region?: string;
    gender?: string;
    /**
     * Drop the people the viewer already follows — `?excludeFollowing=true`.
     *
     * Server-side, and it has to be: filtering the loaded page here costs a row
     * per page that no cursor can top back up, so a long list silently runs
     * short. The service pages AFTER excluding, and has a test saying a page of
     * three comes back as three.
     *
     * ONE DIRECTION, by design: somebody who follows YOU is still suggested,
     * because you have not followed them — which is exactly who a "people to
     * follow" rail should surface. Signed out it is a no-op rather than an
     * error, since a reader who follows nobody excludes nobody.
     *
     * A STRING, not a boolean. The parameter is a `"true" | "false"` enum
     * upstream and anything else is a 400 — deliberately not a coerced boolean,
     * which would read the string "false" as true.
     */
    excludeFollowing?: boolean;
    /**
     * Drop the people the viewer has a standing wink at — `?excludeWinked=true`.
     *
     * A wink is the friends deck's positive answer, so the person it went to
     * is no longer a suggestion. The service excludes them with a WHERE
     * clause, so a page of 30 is 30 rows AFTER the exclusion; filtering the
     * loaded page instead leaves holes no cursor can top up.
     */
    excludeWinked?: boolean;
    excludeWinkedEver?: boolean;
    excludePassed?: boolean;
  } = {}
) {
  const query = params.query?.trim() ?? "";
  const city = params.city?.trim() ?? "";
  const region = params.region?.trim() ?? "";
  const gender = params.gender?.trim() ?? "";
  return PeoplePageSchema.parse(
    await msApi.get("/profiles", {
      ...(query ? { q: query } : {}),
      // Omitted when empty rather than sent blank: `city=` reads as "match the
      // empty string", which is not the same request as "do not filter".
      ...(city ? { city } : {}),
      ...(region ? { region } : {}),
      ...(gender ? { gender } : {}),
      // Sent only when asked for: the default is "do not filter", and an
      // explicit `excludeFollowing=false` is a different request to make.
      ...(params.excludeFollowing ? { excludeFollowing: "true" } : {}),
      ...(params.excludeWinked ? { excludeWinked: "true" } : {}),
      ...(params.excludeWinkedEver ? { excludeWinkedEver: "true" } : {}),
      ...(params.excludePassed ? { excludePassed: "true" } : {}),
      sort: parsePeopleSort(params.sort),
      limit: 30,
      cursor: params.cursor,
    })
  );
}
