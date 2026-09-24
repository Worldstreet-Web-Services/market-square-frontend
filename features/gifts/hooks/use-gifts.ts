"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { errorCode } from "@/lib/api/envelope";
import { buyGift, fetchGiftCatalog, fetchGiftInventory } from "@/features/gifts/lib/api";
import type { GiftHolding } from "@/features/gifts/lib/types";

const CATALOG_KEY = ["ms", "gift-catalog"] as const;
const INVENTORY_KEY = ["ms", "gift-inventory"] as const;

/**
 * WHETHER THIS DEPLOYMENT HAS A GIFT ECONOMY AT ALL.
 *
 * `undefined` while the read is in flight, `false` once a 404 has been seen,
 * `true` once the route has answered. THREE states, not two, and the
 * difference is the whole design: a control that hides itself while a lookup
 * is still in the air flickers, and one that hides on a network blip removes
 * a feature over a dropped packet.
 *
 * Same shape the tips slice uses for its own availability, for the same
 * reason — a 404 is a fact about the DEPLOYMENT, not about the thing you
 * happened to tap.
 */
export function useGiftEconomy(): boolean | undefined {
  const { authenticated } = useAuth();
  const query = useQuery({
    queryKey: CATALOG_KEY,
    queryFn: fetchGiftCatalog,
    enabled: authenticated,
    // The catalogue is a price list, not a feed. It changes when the product
    // changes, so it is read once a session rather than polled.
    staleTime: Infinity,
    retry: false,
  });
  if (query.isSuccess) return true;
  if (query.isError) return errorCode(query.error) === "NOT_FOUND" ? false : undefined;
  return undefined;
}

/** The service's price table, empty until it carries one. */
export function useGiftCatalog() {
  const { authenticated } = useAuth();
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: fetchGiftCatalog,
    enabled: authenticated,
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * WHAT THIS READER OWNS.
 *
 * @param enabled  Off where nothing is showing a count — the gallery and the
 *                 room tray both want this, and neither wants it while closed.
 *
 * NOT POLLED. An inventory moves when YOU buy or YOU send, and both of those
 * go through mutations that invalidate this key. A poll would be asking the
 * server to repeat what this client already knows it did.
 */
export function useGiftInventory(enabled = true) {
  const { authenticated } = useAuth();
  return useQuery({
    queryKey: INVENTORY_KEY,
    queryFn: fetchGiftInventory,
    enabled: enabled && authenticated,
    retry: false,
  });
}

/** `giftId -> how many I own`, for the surfaces that render a count per tile. */
export function ownedByGift(items: GiftHolding[] | undefined): Map<string, number> {
  const owned = new Map<string, number>();
  for (const item of items ?? []) owned.set(item.giftId, item.quantity);
  return owned;
}

/**
 * Buy gifts into the reader's own stock.
 *
 * NO OPTIMISTIC COUNT. Every other mutation in this app flips something the
 * reader can see and rolls it back on failure; this one moves MONEY, and a
 * count that went up before the charge landed is a claim that a purchase
 * happened. The new quantity is read back from the service's own answer, and
 * the inventory is invalidated so anything else rendering a count agrees.
 */
export function useBuyGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: buyGift,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVENTORY_KEY });
      // A purchase spends KASH, so the balance every surface shows is stale.
      void queryClient.invalidateQueries({ queryKey: ["kash", "account"] });
    },
  });
}
