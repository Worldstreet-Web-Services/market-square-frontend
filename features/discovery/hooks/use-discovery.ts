"use client";

import { useQuery } from "@tanstack/react-query";
import { searchMarket } from "@/features/discovery/lib/api";

export function useDiscovery(query: string, type: string) {
  return useQuery({
    queryKey: ["ms", "discovery", query.trim(), type],
    queryFn: () => searchMarket(query, type),
    staleTime: 30_000,
  });
}
