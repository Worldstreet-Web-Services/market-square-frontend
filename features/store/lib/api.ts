"use client";

import { msApi } from "@/lib/api/service";
import {
  MyOrdersSchema,
  StoreItemSchema,
  StoreListSchema,
  StoreOrderSchema,
  type StoreCategory,
} from "@/features/store/lib/types";

export async function fetchStoreItems(category?: StoreCategory) {
  return StoreListSchema.parse(await msApi.get("/store/items", { category }));
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
