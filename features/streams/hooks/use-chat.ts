"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import { fetchChat, sendChat, setChatReaction } from "@/features/streams/lib/api";

const CHAT_POLL_MS = 5_000;

// Polling now; the transport upgrades to WebSocket later without the panel
// changing shape.
export function useChat(streamId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "stream", streamId, "chat"],
    queryFn: () => fetchChat(streamId),
    enabled,
    refetchInterval: enabled ? CHAT_POLL_MS : false,
  });
}

/**
 * WHAT WAS SAID BEFORE the polled head — the pages behind `nextCursor`,
 * fetched only when the reader scrolls up for them and never on the poll.
 *
 * Two queries rather than one infinite query on purpose: TanStack refetches
 * EVERY page of an infinite query on its interval, so a reader who had
 * scrolled back through ten pages would cost ten requests every five
 * seconds. The head (`useChat`) stays the one polled request; history is
 * seeded from the head's own cursor and grows only on demand. The panel
 * merges the two through `oldestFirst`, which also drops the overlap a page
 * shares with the head that was polled after it.
 */
export function useChatHistory(streamId: string, after: string | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["ms", "stream", streamId, "chat", "history", after],
    queryFn: ({ pageParam }) => fetchChat(streamId, pageParam),
    initialPageParam: after,
    getNextPageParam: (last) => last.nextCursor,
    enabled: enabled && after !== null,
    staleTime: Infinity,
  });
}

/**
 * LOVING A MESSAGE.
 *
 * The chat is invalidated rather than patched: the count is the SERVICE's
 * tally across everybody, and a client that added one to its own copy would be
 * guessing about other people. The poll is a few seconds, so the row settles
 * quickly and settles correctly.
 */
export function useChatReaction(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      emoji,
      loved,
    }: {
      messageId: string;
      emoji: string;
      loved: boolean;
    }) => setChatReaction(streamId, messageId, emoji, loved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "chat"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't react to that message.")),
  });
}

export function useSendChat(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      text,
      replyToId,
      mentions,
    }: {
      text: string;
      /** The message being answered, when the sender picked one. */
      replyToId?: string;
      /** Profile ids named in the text, so the handles link to people. */
      mentions?: string[];
    }) => sendChat(streamId, text, { replyToId, mentions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "chat"] });
    },
  });
}
