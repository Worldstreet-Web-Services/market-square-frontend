"use client";

import { useQuery } from "@tanstack/react-query";
import { searchMentions } from "@/lib/api/mentions";

/**
 * The people search behind an open @-token. Shared by every field that takes
 * a mention (post composer, comment boxes, chat composer); lifted out of the
 * feed slice so the chat composer can reach it without a cross-slice import.
 */
export function useMentionSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "mentions", query.trim()],
    queryFn: () => searchMentions(query),
    enabled,
    staleTime: 30_000,
  });
}
