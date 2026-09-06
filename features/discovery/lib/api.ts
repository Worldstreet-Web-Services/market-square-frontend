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

export async function fetchTopics() {
  return TopicListSchema.parse(await msApi.get("/topics"));
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
      sort: parsePeopleSort(params.sort),
      limit: 30,
      cursor: params.cursor,
    })
  );
}
