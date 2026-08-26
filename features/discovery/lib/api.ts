import { msApi } from "@/lib/api/service";
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
export async function fetchPeople(params: { query?: string; cursor?: string } = {}) {
  const query = params.query?.trim() ?? "";
  return PeoplePageSchema.parse(
    await msApi.get("/profiles", {
      ...(query ? { q: query } : {}),
      sort: "followers",
      limit: 30,
      cursor: params.cursor,
    })
  );
}
