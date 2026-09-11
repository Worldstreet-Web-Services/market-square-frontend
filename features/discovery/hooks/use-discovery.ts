"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { useAuth } from "@/hooks/use-auth";
import { sortTopicsByOrder } from "@/lib/topic-order";
import type { PeopleSort } from "@/lib/people-filters";
import {
  fetchCategories,
  fetchPeople,
  fetchMyInterests,
  fetchTopics,
  type TopicSurface,
  saveMyInterests,
  searchMarket,
} from "@/features/discovery/lib/api";

// A blank query returns nothing from the service, so the request is not even
// sent — an empty result list is the correct resting state of the page.
export function useDiscovery(query: string, type: string, topics: string[] = []) {
  const trimmed = query.trim();
  // Sorted so the same selection always produces the same cache key.
  const topicKey = [...topics].sort().join(",");
  return useInfiniteQuery({
    queryKey: ["ms", "discovery", trimmed, type, topicKey],
    queryFn: ({ pageParam }) => searchMarket(trimmed, type, pageParam ?? undefined, topics),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["ms", "categories"],
    queryFn: fetchCategories,
    staleTime: 60_000,
  });
}

/**
 * The canonical topic list.
 *
 * `GET /topics` ships on its own cadence; a 404 means "not deployed", not
 * "broken", so the picker simply does not offer topics yet rather than
 * inventing a list of its own. Retrying a missing route only delays that.
 */
export function useTopics(surface?: TopicSurface) {
  return useQuery({
    // The surface is IN the key: `sortOrder` is a position on that surface, so
    // one surface's list must never be served to another.
    queryKey: ["ms", "topics", surface ?? "all"],
    // Ordered by the backend's own `sortOrder`, EXPLICITLY — see the note in
    // `lib/topic-order.ts` for why the served order is not trusted.
    queryFn: async () => sortTopicsByOrder(await fetchTopics(surface)),
    staleTime: 5 * 60_000,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
}

export function useMyInterests() {
  const { authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "interests"],
    queryFn: fetchMyInterests,
    enabled: authenticated,
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });
}

/**
 * Persist the viewer's topics.
 *
 * Interests reorder the feed and Explore, so both are invalidated on success —
 * a saved interest that does not change what you see reads as a no-op.
 */
export function useSaveInterests() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveMyInterests,
    onSuccess: (result) => {
      client.setQueryData(["ms", "interests"], result);
      client.invalidateQueries({ queryKey: ["ms", "feed"] });
      client.invalidateQueries({ queryKey: ["ms", "discovery"] });
      toast.success("Interests saved");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't save your interests.")),
  });
}

/**
 * Explore's People tab.
 *
 * Populated on ARRIVAL — a discovery surface that opens as a prompt to go and
 * find something is not a discovery surface. A query narrows this same list
 * rather than switching to `/search`, so browsing and searching people share
 * one cursor instead of two lists that page differently.
 *
 * Public: signed-out visitors get the list too, and only the Follow action
 * asks them to sign in.
 */
export function usePeople(
  query: string,
  sort: PeopleSort = "followers",
  enabled = true,
  /**
   * Place and gender, narrowed by the SERVICE.
   *
   * In the query key for the same reason `sort` is: the cursor encodes the
   * filter, so changing one starts a new list rather than paging the old one
   * with a mismatched token.
   */
  facets: {
    city?: string;
    region?: string;
    gender?: string;
    /** Server-side "not already followed" — see `fetchPeople`. */
    excludeFollowing?: boolean;
  } = {}
) {
  const trimmed = query.trim();
  const city = facets.city?.trim() ?? "";
  const region = facets.region?.trim() ?? "";
  const gender = facets.gender?.trim() ?? "";
  const excludeFollowing = Boolean(facets.excludeFollowing);
  return useInfiniteQuery({
    // The sort is in the KEY, not applied to a loaded page. Re-ordering one
    // page would make page 1 look sorted while page 2 contradicted it; the
    // service's cursor encodes the sort key, so changing it starts a new list.
    // In the KEY for the same reason the facets are: the cursor encodes the
    // filter, so changing it starts a new list rather than paging the old one
    // with a token that no longer describes it.
    queryKey: ["ms", "people", trimmed, sort, city, region, gender, excludeFollowing],
    queryFn: ({ pageParam }) =>
      fetchPeople({
        query: trimmed,
        sort,
        city,
        region,
        gender,
        excludeFollowing,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Only the People tab needs this; every other tab would be paying for a
    // directory nobody is looking at.
    enabled,
    staleTime: 30_000,
  });
}
