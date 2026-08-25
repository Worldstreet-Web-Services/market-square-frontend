"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { useAuth } from "@/hooks/use-auth";

/**
 * The primary nav's unread badges.
 *
 * `GET /me/unread` answers both counts in one call, and both are GLOBAL — the
 * whole point of the endpoint. Badge counts are never derived from a page of
 * the inbox or the notification list, which would undercount past page one.
 *
 * Cadence: 45s. It is two aggregate queries server-side, so a tighter loop
 * would cost more than it is worth for a number that only ever nudges a badge.
 * Anything that changes a count locally — sending a message, marking a thread
 * or the notification list read — invalidates this key immediately through
 * `useRefreshUnread`, so the poll is a backstop for *other people's* activity
 * rather than the path for your own.
 */
const UnreadSchema = z.object({
  messages: z.number().optional().default(0),
  notifications: z.number().optional().default(0),
});

export const UNREAD_KEY = ["ms", "unread"] as const;
const UNREAD_POLL_MS = 45_000;

export function useUnread() {
  const { authenticated } = useAuth();
  return useQuery({
    queryKey: UNREAD_KEY,
    queryFn: async () => UnreadSchema.parse(await msApi.authedGet("/me/unread")),
    enabled: authenticated,
    refetchInterval: UNREAD_POLL_MS,
  });
}

/** Pull the counts forward after an action that just changed them. */
export function useRefreshUnread() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: UNREAD_KEY });
}
