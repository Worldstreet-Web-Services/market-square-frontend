"use client";

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
  });
}

export function useEntitlementLookup() {
  return useMutation({ mutationFn: lookupEntitlement });
}
