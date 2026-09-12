"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { toast } from "sonner";

/**
 * WHAT THE PLATFORM IS SAYING TO EVERYONE.
 *
 * Global rather than owned by a slice, like `useUnread` beside it: the band
 * belongs to the shell, and no feature owns it.
 *
 * ─── THE THREE RULES THAT DECIDE THE UI ──────────────────────────────────────
 *  · `dismissedByMe` is ABSENT for a signed-out reader and a boolean for a
 *    signed-in one — the same distinction `remindedByMe` carries. Absent means
 *    "there is nobody to have dismissed it", which is not "not dismissed".
 *  · A DISMISSED ANNOUNCEMENT IS STILL RETURNED, marked true, rather than
 *    filtered server-side. That is deliberate: a reader who closed it on their
 *    phone must not meet it again on their laptop. So the skipping happens
 *    HERE.
 *  · `post` is ABSENT — never a placeholder — when there is no post, or when
 *    the post can no longer be shown (deleted, moderated, an expired story).
 *    `postId` may still be set while `post` is gone, so `post` is the one to
 *    trust. It is re-hydrated on every read, which is what makes an author
 *    deleting their post empty the announcement in the same moment.
 *
 * `endsAt` is always present, so a band that has run out is dropped here
 * rather than waiting for the next refetch to notice.
 */
const AnnouncementPostSchema = z.object({
  id: z.string(),
  text: z.string().nullable().optional().default(null),
  mediaUrl: z.string().nullable().optional().default(null),
  mediaKind: z.string().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
});

export const AnnouncementSchema = z.object({
  id: z.string(),
  body: z.string(),
  linkUrl: z.string().nullable().optional().default(null),
  postId: z.string().nullable().optional().default(null),
  // Absent, never a placeholder — see the note above.
  post: AnnouncementPostSchema.optional(),
  startsAt: z.string().optional().default(""),
  endsAt: z.string(),
  // Absent for a signed-out reader. NO default: false would claim they had
  // seen and kept it.
  dismissedByMe: z.boolean().optional(),
  // Admin-facing only, and deliberately never rendered: an announcement reads
  // as coming from the platform, not from a person somebody could argue with.
  createdBy: z.string().nullable().optional().default(null),
  createdVia: z.enum(["admin-user", "internal-key"]).optional(),
  createdAt: z.string().optional().default(""),
});

const AnnouncementPageSchema = z.object({
  items: z.array(AnnouncementSchema).optional().default([]),
});

export type Announcement = z.infer<typeof AnnouncementSchema>;

export const ANNOUNCEMENTS_KEY = ["ms", "announcements"] as const;

export function useAnnouncements() {
  const query = useQuery({
    queryKey: ANNOUNCEMENTS_KEY,
    queryFn: async () => AnnouncementPageSchema.parse(await msApi.get("/announcements")),
    // It is a handful of rows that change rarely, and it is read on every page.
    staleTime: 5 * 60_000,
    // A 404 means the route is not deployed; retrying it is noise.
    retry: (count, error) => errorCode(error) !== "NOT_FOUND" && count < 2,
  });

  const items = query.data?.items ?? [];
  const kept = items.filter((item) => item.dismissedByMe !== true);

  // Re-render once a minute ONLY while there is something to expire, so a band
  // whose window passes goes without waiting for the next refetch.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (kept.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [kept.length]);

  const live = kept.filter((item) => Date.parse(item.endsAt) > now);

  return { ...query, items: live, unavailable: errorCode(query.error) === "NOT_FOUND" };
}

/**
 * Close the band for this reader.
 *
 * Optimistic, because the band must go the instant it is tapped — a banner
 * that lingers while a request settles reads as a control that did not work.
 */
export function useDismissAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => msApi.post<unknown>(`/announcements/${id}/dismiss`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ANNOUNCEMENTS_KEY });
      const before = queryClient.getQueryData(ANNOUNCEMENTS_KEY);
      queryClient.setQueryData<{ items: Announcement[] }>(ANNOUNCEMENTS_KEY, (data) =>
        data
          ? { ...data, items: data.items.map((item) => (item.id === id ? { ...item, dismissedByMe: true } : item)) }
          : data
      );
      return { before };
    },
    onError: (error, _id, context) => {
      if (context?.before) queryClient.setQueryData(ANNOUNCEMENTS_KEY, context.before);
      toast.error(errorMessage(error, "Couldn't close that."));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY }),
  });
}
