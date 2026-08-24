"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/features/notifications/lib/api";

const key = ["ms", "notifications"] as const;

export function useNotifications() {
  return useQuery({ queryKey: key, queryFn: fetchNotifications, refetchInterval: 30_000 });
}

export function useReadNotification() {
  const client = useQueryClient();
  return useMutation({ mutationFn: markNotificationRead, onSuccess: () => client.invalidateQueries({ queryKey: key }) });
}

export function useReadAllNotifications() {
  const client = useQueryClient();
  return useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => client.invalidateQueries({ queryKey: key }) });
}
