"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import { useAuth } from "@/hooks/use-auth";
import { useRefreshUnread } from "@/hooks/use-unread";
import {
  fetchNotifications,
  markNotificationsRead,
} from "@/features/notifications/lib/api";

const key = ["ms", "notifications"] as const;

export function useNotifications() {
  const { authenticated } = useAuth();
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchNotifications(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: authenticated,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const client = useQueryClient();
  const refreshUnread = useRefreshUnread();
  return useMutation({
    mutationFn: (ids?: string[]) => markNotificationsRead(ids),
    // Pull the badge forward rather than waiting out the poll.
    onSuccess: () => {
      client.invalidateQueries({ queryKey: key });
      refreshUnread();
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't mark those as read.")),
  });
}
