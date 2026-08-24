import { msApi } from "@/lib/api/service";
import { CategoryListSchema, DiscoverySchema } from "@/features/discovery/lib/types";

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
