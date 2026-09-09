"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import { useAuth } from "@/hooks/use-auth";
import { useRefreshUnread } from "@/hooks/use-unread";
import {
  fetchConversations,
  fetchMessages,
  markConversationRead,
  openConversation,
  sendMessage,
} from "@/features/messages/lib/api";

// The service publishes `market-square.message.sent` for the ws-gateway
// without the body, so realtime is only ever a "refetch" signal. Until that
// exists an open thread polls on the same cadence as the live room's chat.
const THREAD_POLL_MS = 5_000;

export function useConversations() {
  const { authenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: ["ms", "conversations"],
    queryFn: ({ pageParam }) => fetchConversations(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: authenticated,
    refetchInterval: 30_000,
  });
}

export function useMessages(conversationId: string, open: boolean) {
  return useQuery({
    queryKey: ["ms", "messages", conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: open && Boolean(conversationId),
    refetchInterval: open ? THREAD_POLL_MS : false,
  });
}

export function useSendMessage(conversationId: string) {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  return useMutation({
    mutationFn: (text: string) => sendMessage(conversationId, text),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "messages", conversationId] });
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      refreshUnread();
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't send that message.")),
  });
}

/** Opening a thread is the acknowledgement — the inbox refreshes after it. */
export function useMarkConversationRead() {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  return useMutation({
    mutationFn: markConversationRead,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["ms", "conversations"] });
      refreshUnread();
    },
  });
}

export function useOpenConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: openConversation,
    onSuccess: () => client.invalidateQueries({ queryKey: ["ms", "conversations"] }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't open that conversation.")),
  });
}
