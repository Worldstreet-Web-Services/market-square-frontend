"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { trackMarketEvent } from "@/lib/analytics";
import {
  fetchMyOrders,
  fetchStoreItem,
  fetchStoreItems,
  placeOrder,
} from "@/features/store/lib/api";
import type { StoreCategory } from "@/features/store/lib/types";

export function useStoreItems(category?: StoreCategory, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["ms", "store", category ?? "all"],
    queryFn: ({ pageParam }) => fetchStoreItems(category, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Explore's Products tab only runs this while it is the active tab.
    enabled,
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
      trackMarketEvent("purchase_completed", { surface: "store_detail", entityType: "store_item", entityId: slug });
      trackMarketEvent("entitlement_issued", { surface: "store_detail", entityType: "store_item", entityId: slug });
      toast.success("Order confirmed");
    },
    // onSettled: an order that errored on the way back may still have been
    // recorded, and "Get — Free" must not keep offering an item already owned.
    // The listing and the catalogue are sibling keys, not prefix and child, so
    // both are named — as is /me/orders, which is what "Owned" reads from.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["ms", "store-item", slug] });
      queryClient.invalidateQueries({ queryKey: ["ms", "store"] });
      queryClient.invalidateQueries({ queryKey: ["ms", "my-orders"] });
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
