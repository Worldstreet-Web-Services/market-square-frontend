"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCategories, searchMarket } from "@/features/discovery/lib/api";

export function useDiscovery(query: string, type: string) {
  return useQuery({
    queryKey: ["ms", "discovery", query.trim(), type],
    queryFn: () => searchMarket(query, type),
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
