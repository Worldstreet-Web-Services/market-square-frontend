import { msApi } from "@/lib/api/service";
import {
  CategoryListSchema,
  DiscoverySchema,
  InterestsSchema,
  TopicListSchema,
} from "@/features/discovery/lib/types";

// `limit` is a page size, not a ceiling: the caller pages with `nextCursor`
// rather than stopping at the first 30 matches.
export async function searchMarket(query: string, type: string, cursor?: string) {
  return DiscoverySchema.parse(
    await msApi.get("/search", {
      q: query.trim(),
      type,
      limit: 30,
      cursor,
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
