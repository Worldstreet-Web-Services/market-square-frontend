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

export function useNotifications(group?: string) {
  const { authenticated } = useAuth();
  return useInfiniteQuery({
    // The group is IN THE KEY, for the reason every facet is: the cursor
    // encodes the filter, so changing it must start a new list rather than
    // page the old one with a token that no longer describes it.
    queryKey: [...key, group ?? ""],
    queryFn: ({ pageParam }) => fetchNotifications(pageParam ?? undefined, group),
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
      // The subtree, so every group's list refreshes rather than only the one
      // that happens to be on screen.
      client.invalidateQueries({ queryKey: key });
      refreshUnread();
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't mark those as read.")),
  });
}
