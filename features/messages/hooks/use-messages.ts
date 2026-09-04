"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import { useAuth } from "@/hooks/use-auth";
import { useRefreshUnread } from "@/hooks/use-unread";
import {
  acceptConversation,
  createGroup,
  declineConversation,
  fetchConversationMembers,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  openConversation,
  sendMessage,
} from "@/features/messages/lib/api";
import type { OutgoingMessage } from "@/features/messages/lib/types";
import { tabQuery, type InboxTab } from "@/features/messages/lib/filter";

// The service publishes `market-square.message.sent` for the ws-gateway
// without the body, so realtime is only ever a "refetch" signal. Until that
// exists an open thread polls on the same cadence as the live room's chat.
const THREAD_POLL_MS = 5_000;

/**
 * One tab's conversations.
 *
 * The TAB IS IN THE QUERY KEY, so each of the four caches and pages
 * independently. Sharing one key would make switching tabs replay the previous
 * tab's rows under the new tab's name until the refetch landed, and paging
 * would carry a cursor minted for a different filter.
 */
export function useConversations(tab: InboxTab = "all") {
  const { authenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: ["ms", "conversations", tab],
    queryFn: ({ pageParam }) => fetchConversations(pageParam ?? undefined, tabQuery(tab)),
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

/**
 * The roster behind a group thread's avatars and its members sheet.
 *
 * ONE query for both, deliberately. The bubbles need it to turn a `senderId`
 * into a face, and the sheet needs it to list who is in the room; two queries
 * would poll the same route twice and could disagree about the membership
 * inside one render.
 *
 * `enabled` is the caller's answer to "is this a group", so a 1:1 thread never
 * issues the request at all. No `refetchInterval`: membership changes when
 * somebody adds or removes a person, which is a mutation this client makes or
 * a change the next open picks up — not something worth a 5s poll beside the
 * message poll that already runs.
 */
export function useConversationMembers(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ms", "conversation-members", conversationId],
    queryFn: () => fetchConversationMembers(conversationId),
    enabled: enabled && Boolean(conversationId),
    // A group of 75 does not change between two openings of the same thread.
    staleTime: 60_000,
  });
}

export function useSendMessage(conversationId: string) {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  return useMutation({
    mutationFn: (body: OutgoingMessage) => sendMessage(conversationId, body),
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

/**
 * Creates a group thread.
 *
 * Invalidates the inbox rather than writing the new row into it: the service
 * decides the group's shape (the creator's `owner` role, the capped member
 * preview, the member count) and a hand-built optimistic row would be a second
 * guess at all three that the next poll silently corrects.
 */
export function useCreateGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      title: string;
      memberIds: string[];
      description?: string;
      imageUrl?: string;
      /** Whether somebody holding the link may join themselves. */
      visibility?: "public" | "private";
    }) => createGroup(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ms", "conversations"] }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't create that group.")),
  });
}

/**
 * Accept or decline a chat request.
 *
 * Both invalidate every conversation list, not just the requests tab: accepting
 * MOVES a row from Gist Requests into All and Gists, so a tab that kept its
 * cached page would show the same conversation in two places at once.
 */
export function useAnswerRequest() {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  const settle = () => {
    client.invalidateQueries({ queryKey: ["ms", "conversations"] });
    refreshUnread();
  };
  const accept = useMutation({
    mutationFn: acceptConversation,
    onSuccess: settle,
    onError: (error) => toast.error(errorMessage(error, "Couldn't accept that request.")),
  });
  const decline = useMutation({
    mutationFn: declineConversation,
    onSuccess: settle,
    onError: (error) => toast.error(errorMessage(error, "Couldn't decline that request.")),
  });
  return { accept, decline };
}

export function useOpenConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: openConversation,
    onSuccess: () => client.invalidateQueries({ queryKey: ["ms", "conversations"] }),
    onError: (error) => toast.error(errorMessage(error, "Couldn't open that conversation.")),
  });
}
