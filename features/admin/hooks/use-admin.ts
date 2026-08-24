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
import { useMe } from "@/hooks/use-me";
import type { OrgBadge } from "@/lib/api/schemas";
import {
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
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Couldn't resolve that application."));
      client.invalidateQueries({ queryKey: key });
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
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Couldn't resolve that request."));
      client.invalidateQueries({ queryKey: key });
    },
  });
}

export function useSetProfileVerification() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, verified }: { profileId: string; verified: boolean }) =>
      setProfileVerification(profileId, verified),
    onSuccess: (_profile, { verified }) => {
      toast.success(verified ? "Verified" : "Verification removed");
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
      client.invalidateQueries({ queryKey: ["ms", "profile"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update verification.")),
  });
}

export function useSetProfileOrgBadge() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, badge }: { profileId: string; badge: OrgBadge }) =>
      setProfileOrgBadge(profileId, badge),
    onSuccess: (_profile, { badge }) => {
      toast.success(badge ? `${badge === "market" ? "MARKET" : "ARK"} badge assigned` : "Badge cleared");
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
      client.invalidateQueries({ queryKey: ["ms", "profile"] });
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't update the badge.")),
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
    onSuccess: (_result, { action }) => {
      toast.success(action === "remove" ? "Content removed" : "Report dismissed");
      client.invalidateQueries({ queryKey: ["ms", "admin"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Couldn't resolve that report."));
      client.invalidateQueries({ queryKey: key });
    },
  });
}

export { notDeployed };
