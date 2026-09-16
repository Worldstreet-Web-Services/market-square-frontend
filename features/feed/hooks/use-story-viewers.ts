"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchStoryViewers } from "@/features/feed/lib/api";
import { shouldRetryViewers } from "@/lib/story-viewers";

/**
 * Who viewed a story, a page at a time — asked ONLY for the reader's own story.
 *
 * `enabled` is the caller's "this is mine": the route is author-only, so asking
 * on somebody else's story is a guaranteed 404 on every story anyone opens.
 * A 4xx is never retried; see lib/story-viewers.ts.
 */
export function useStoryViewers(storyId: string | undefined, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["ms", "story-viewers", storyId],
    queryFn: ({ pageParam }) => fetchStoryViewers(storyId ?? "", pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: enabled && Boolean(storyId),
    retry: shouldRetryViewers,
  });
}

export type StoryViewersQuery = ReturnType<typeof useStoryViewers>;
