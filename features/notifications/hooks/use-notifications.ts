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

/**
 * @param poll  WHETHER THIS READER IS WATCHING THE LIST. Default OFF.
 *
 * This used to poll at 30s unconditionally, and the cost of that was not on
 * the notifications page — it was on every OTHER page. `FriendsPopup` is
 * mounted in `ShellFrame`, so it renders on every route for every signed-in
 * reader, and it calls this hook. The result was a second global 30s interval
 * that nobody could see: 2 req/min per user, on every route, all session, to
 * keep a popup warm that opens at most once — and it is an INFINITE query, so
 * a reader several pages deep re-downloaded EVERY loaded page on each tick.
 *
 * It also made the measured idle floor wrong. Home was believed to cost 5.33
 * req/min per idle user; with this it is 7.33, a third higher than anyone
 * thought, and the extra was invisible because no screen showed it.
 *
 * So the interval is now opt-in and belongs to the surface actually being
 * read. The popup does not pass it: it is refreshed by an explicit
 * invalidation when the unread count moves (`useRefreshUnread`), which is the
 * event it cares about, rather than by asking twice a minute whether the event
 * happened. That is the same shape ADR-0009 asks for everywhere else — a
 * signal, with the poll as a floor only where a reader is watching.
 */
export function useNotifications(group?: string, poll = false) {
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
    refetchInterval: poll ? 30_000 : false,
    /**
     * ONLY THE HEAD IS REFETCHED. An infinite query refetches every loaded
     * page on each tick and on every window focus, so a reader ten pages into
     * their notifications was re-downloading three hundred rows — each with a
     * full embedded profile — twice a minute. `maxPages` bounds the window
     * that a refetch has to replay.
     */
    maxPages: 3,
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
