"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchMyOrders,
  fetchStoreItem,
  fetchStoreItems,
  placeOrder,
} from "@/features/store/lib/api";
import type { StoreCategory } from "@/features/store/lib/types";

export function useStoreItems(category?: StoreCategory) {
  return useQuery({
    queryKey: ["ms", "store", category ?? "all"],
    queryFn: () => fetchStoreItems(category),
  });
}

export function useStoreItem(slug: string) {
  return useQuery({
    queryKey: ["ms", "store-item", slug],
    queryFn: () => fetchStoreItem(slug),
  });
}

export function usePlaceOrder(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => placeOrder(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "store-item", slug] });
      queryClient.invalidateQueries({ queryKey: ["ms", "store"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "my-orders"] });
      toast.success("Order confirmed");
    },
  });
}

export function useMyOrders() {
  const { ready, authenticated } = useAuth();
  return useQuery({
    queryKey: ["ms", "my-orders"],
    queryFn: fetchMyOrders,
    enabled: ready && authenticated,
  });
}

// Items don't embed the viewer's order; "owned" is derived from /me/orders.
export function useMyOrderFor(itemId: string | undefined) {
  const orders = useMyOrders();
  if (!itemId || !orders.data) return null;
  return orders.data.orders.find((o) => o.itemId === itemId && o.status === "confirmed") ?? null;
}
