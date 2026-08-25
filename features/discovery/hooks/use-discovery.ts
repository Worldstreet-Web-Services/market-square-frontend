"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchCategories, searchMarket } from "@/features/discovery/lib/api";

// A blank query returns nothing from the service, so the request is not even
// sent — an empty result list is the correct resting state of the page.
export function useDiscovery(query: string, type: string) {
  const trimmed = query.trim();
  return useInfiniteQuery({
    queryKey: ["ms", "discovery", trimmed, type],
    queryFn: ({ pageParam }) => searchMarket(trimmed, type, pageParam ?? undefined),
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
