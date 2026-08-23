"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChat, sendChat } from "@/features/streams/lib/api";

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

export function useSendChat(streamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => sendChat(streamId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "chat"] });
    },
  });
}
