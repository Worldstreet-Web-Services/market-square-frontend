"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { errorCode, errorMessage } from "@/lib/api/envelope";
import { invalidateContentSurfaces, invalidateIdentitySurfaces } from "@/lib/api/invalidate";
import { useMe } from "@/hooks/use-me";
import { ANNOUNCEMENTS_KEY } from "@/hooks/use-announcements";
import type { OrgBadge } from "@/lib/api/schemas";
import {
  createAnnouncement,
  endAnnouncement,
  fetchAdminAnnouncements,
  fetchAdminProfiles,
  fetchAdminReports,
  fetchAdminStats,
  fetchRoleApplications,
  fetchVerificationRequests,
  resolveReport,
  resolveRoleApplication,
  resolveVerificationRequest,
  setProfileOrgBadge,
  setProfileVerification,
} from "@/features/admin/lib/api";
import type {
  RoleApplicationPageSchema,
  VerificationRequestPageSchema,
} from "@/features/admin/lib/types";
import type { z } from "zod";

/**
 * Admin console data layer.
 *
 * Several of these endpoints ship on the backend's own cadence. A 404 means
 * "not deployed", not "broken": those sections say so and stay quiet, and they
 * begin working the moment the route appears — no frontend change needed.
 *
 * `retry` is suppressed for NOT_FOUND so a missing route resolves immediately
 * instead of stalling the panel through three back-offs.
 */
const notDeployed = (error: unknown) => errorCode(error) === "NOT_FOUND";
const retryUnlessMissing = (count: number, error: unknown) => !notDeployed(error) && count < 2;

/** Presentation gate only — the server enforces on every route. */
export function useIsAdmin(): { ready: boolean; isAdmin: boolean } {
  const me = useMe();
  return { ready: !me.isPending, isAdmin: Boolean(me.data?.isAdmin) };
}

export function useAdminStats() {
  const { isAdmin } = useIsAdmin();
  return useQuery({
    queryKey: ["ms", "admin", "stats"],
    queryFn: fetchAdminStats,
    enabled: isAdmin,
    retry: retryUnlessMissing,
    staleTime: 30_000,
  });
}

export function useRoleApplications() {
  const { isAdmin } = useIsAdmin();
  return useInfiniteQuery({
    queryKey: ["ms", "admin", "role-applications"],
    queryFn: ({ pageParam }) => fetchRoleApplications(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isAdmin,
    retry: retryUnlessMissing,
  });
}

export function useVerificationRequests() {
  const { isAdmin } = useIsAdmin();
  return useInfiniteQuery({
    queryKey: ["ms", "admin", "verification-requests"],
    queryFn: ({ pageParam }) => fetchVerificationRequests(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isAdmin,
    retry: retryUnlessMissing,
  });
}

export function useAdminReports() {
  const { isAdmin } = useIsAdmin();
  return useInfiniteQuery({
    queryKey: ["ms", "admin", "reports"],
    queryFn: ({ pageParam }) => fetchAdminReports(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isAdmin,
    retry: retryUnlessMissing,
  });
}

export function useAdminAnnouncements() {
  const { isAdmin } = useIsAdmin();
  return useInfiniteQuery({
    queryKey: ["ms", "admin", "announcements"],
    queryFn: ({ pageParam }) => fetchAdminAnnouncements(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isAdmin,
    retry: retryUnlessMissing,
  });
}

export function useCreateAnnouncement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => toast.success("Announcement published"),
    // A 404 here is not "the route is missing" — it is the service refusing a
    // post it cannot show. Saying so is the difference between an operator
    // fixing the id and an operator thinking the console is broken.
    onError: (error) =>
      toast.error(
        errorCode(error) === "NOT_FOUND"
          ? "That post can't be announced — it may have been deleted or hidden."
          : errorMessage(error, "Couldn't publish that announcement.")
      ),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["ms", "admin", "announcements"] });
      // The band reads its own key, and it is what every reader sees — so the
      // operator's own Home shows the banner at once rather than on the next
      // poll. Checking your own copy is the only proof it reads correctly.
      client.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
    },
  });
}

export function useEndAnnouncement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => endAnnouncement(id),
    onSuccess: () => toast.success("Announcement ended"),
    onError: (error) => toast.error(errorMessage(error, "Couldn't end that announcement.")),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["ms", "admin", "announcements"] });
      client.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEY });
    },
  });
}

export function useAdminProfiles(query: string) {
  const { isAdmin } = useIsAdmin();
  return useInfiniteQuery({
    queryKey: ["ms", "admin", "profiles", query.trim()],
    queryFn: ({ pageParam }) => fetchAdminProfiles(query, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isAdmin,
    retry: retryUnlessMissing,
  });
}

type RolePage = z.infer<typeof RoleApplicationPageSchema>;
type VerificationPage = z.infer<typeof VerificationRequestPageSchema>;

/** Drop a resolved row from every cached page of a queue. */
function dropRow<T extends { items: Array<{ id: string }>; nextCursor: string | null }>(
  data: InfiniteData<T> | undefined,
  id: string
): InfiniteData<T> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== id),
    })),
  };
}

/**
 * Resolving a queue row.
 *
 * The row leaves the list immediately, then the queue is refetched for truth.
 * On failure the row is restored by that same refetch and the error surfaces —
 * an optimistic removal that silently swallowed a rejection would leave the
 * operator believing they had actioned something they had not.
 */
export function useResolveRoleApplication() {
  const client = useQueryClient();
  const key = ["ms", "admin", "role-applications"];
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      resolveRoleApplication(id, approve, note),
    onMutate: ({ id }) => {
      client.setQueryData<InfiniteData<RolePage>>(key, (data) => dropRow(data, id));
    },
    onSuccess: (_result, { approve }) => {
      toast.success(approve ? "Application approved" : "Application rejected");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't resolve that application.")),
    // onSettled, not onSuccess: a failure must also put the optimistically
    // removed row back and re-sync the surfaces, or the console shows the
    // operator a queue that no longer matches the service.
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
      // Approving grants the creator role, and a role chip is copied into
      // every author row — not read from the profile query.
      invalidateIdentitySurfaces(client);
    },
  });
}

export function useResolveVerificationRequest() {
  const client = useQueryClient();
  const key = ["ms", "admin", "verification-requests"];
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      resolveVerificationRequest(id, approve, note),
    onMutate: ({ id }) => {
      client.setQueryData<InfiniteData<VerificationPage>>(key, (data) => dropRow(data, id));
    },
    onSuccess: (_result, { approve }) => {
      toast.success(approve ? "Verification approved" : "Verification rejected");
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't resolve that request.")),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
      // The silver check rides on every author row.
      invalidateIdentitySurfaces(client);
    },
  });
}

export function useSetProfileVerification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, verified }: { profileId: string; verified: boolean }) =>
      setProfileVerification(profileId, verified),
    onSuccess: (_profile, { verified }) =>
      toast.success(verified ? "Verified" : "Verification removed"),
    onError: (error) => toast.error(errorMessage(error, "Couldn't update verification.")),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
      invalidateIdentitySurfaces(client);
    },
  });
}

export function useSetProfileOrgBadge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, badge }: { profileId: string; badge: OrgBadge }) =>
      setProfileOrgBadge(profileId, badge),
    onSuccess: (_profile, { badge }) =>
      toast.success(badge ? `${badge === "market" ? "MARKET" : "ARK"} badge assigned` : "Badge cleared"),
    onError: (error) => toast.error(errorMessage(error, "Couldn't update the badge.")),
    onSettled: () => {
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
      invalidateIdentitySurfaces(client);
    },
  });
}

export function useResolveReport() {
  const client = useQueryClient();
  const key = ["ms", "admin", "reports"];
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "remove" | "dismiss" }) =>
      resolveReport(id, action),
    onMutate: ({ id }) => {
      client.setQueryData<InfiniteData<{ items: Array<{ id: string }>; nextCursor: string | null }>>(
        key,
        (data) => dropRow(data, id)
      );
    },
    onSuccess: (_result, { action }) =>
      toast.success(action === "remove" ? "Content removed" : "Report dismissed"),
    onError: (error) => toast.error(errorMessage(error, "Couldn't resolve that report.")),
    onSettled: (_result, _error, { action }) => {
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
      // Dismissing changes nothing a reader can see; removing deletes a post
      // that the timeline and anyone's Arkmarks are still holding a copy of.
      if (action === "remove") invalidateContentSurfaces(client);
    },
  });
}

export { notDeployed };
