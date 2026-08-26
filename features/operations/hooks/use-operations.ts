"use client";

import { toast } from "sonner";
import { errorMessage } from "@/lib/api/envelope";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOperations, lookupEntitlement, resolveCase } from "@/features/operations/lib/api";

export function useOperations() {
  return useQuery({ queryKey: ["ms", "operations"], queryFn: fetchOperations, refetchInterval: 30_000 });
}

export function useResolveCase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: "resolved" | "dismissed" }) => resolveCase(id, resolution),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ms", "operations"] }),
    // An operator action that fails must say so. This was the only
    // user-initiated mutation in the app with no error path at all — a
    // moderator could click Resolve, see nothing happen, and assume it worked.
    onError: (error) => toast.error(errorMessage(error, "Couldn't resolve that case.")),
  });
}

export function useEntitlementLookup() {
  return useMutation({ mutationFn: lookupEntitlement });
}
