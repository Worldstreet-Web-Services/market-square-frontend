"use client";

import { msApi } from "@/lib/api/service";
import {
  MyOrdersSchema,
  StoreItemSchema,
  StoreListSchema,
  StoreOrderSchema,
  type StoreCategory,
} from "@/features/store/lib/types";

// `nextCursor` is the service's own paging token; the page used to throw it
// away and slice the first response client-side, so "Load more" could never
// reach anything past the first response.
export async function fetchStoreItems(category?: StoreCategory, cursor?: string) {
  return StoreListSchema.parse(await msApi.get("/store/items", { category, limit: 12, cursor }));
}

export async function fetchStoreItem(slug: string) {
  return StoreItemSchema.parse(await msApi.get(`/store/items/${slug}`));
}

export async function placeOrder(slug: string) {
  return StoreOrderSchema.parse(await msApi.post(`/store/items/${slug}/orders`, {}));
}

export async function fetchMyOrders() {
  return MyOrdersSchema.parse(await msApi.authedGet("/me/orders"));
}
