"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCategories,
  fetchMyInterests,
  fetchTopics,
  saveMyInterests,
  searchMarket,
} from "@/features/discovery/lib/api";

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

/**
 * The canonical topic list.
 *
 * `GET /topics` ships on its own cadence; a 404 means "not deployed", not
 * "broken", so the picker simply does not offer topics yet rather than
 * inventing a list of its own. Retrying a missing route only delays that.
 */
export function useTopics() {
  return useQuery({
    queryKey: ["ms", "topics"],
    queryFn: fetchTopics,
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
