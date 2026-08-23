import { z } from "zod";

// Mirrors the backend contract: category is SINGULAR (app|product|service),
// pricing is free|kash, actionKind is open|download|purchase. Store items do
// not embed the viewer's order — that comes from GET /me/orders.

export const STORE_CATEGORIES = ["app", "product", "service"] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export const StoreItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable().optional().default(null),
  description: z.string().nullable().optional().default(null),
  category: z.enum(STORE_CATEGORIES).catch("app"),
  iconUrl: z.string().nullable().optional().default(null),
  bannerUrl: z.string().nullable().optional().default(null),
  pricing: z.enum(["free", "kash"]).catch("free"),
  priceKash: z.string().nullable().optional().default(null),
  actionKind: z.enum(["open", "download", "purchase"]).catch("open"),
  actionUrl: z.string().optional().default(""),
  installCount: z.number().optional().default(0),
  createdAt: z.string().optional().default(""),
});

export const StoreListSchema = z.object({
  items: z.array(StoreItemSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export const StoreOrderSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  priceKash: z.string(),
  status: z.enum(["pending", "confirmed", "failed", "refunded"]).catch("confirmed"),
  createdAt: z.string(),
});

export const MyOrderSchema = StoreOrderSchema.extend({
  item: StoreItemSchema.nullable().optional().default(null),
});

// GET /me/orders returns a BARE ARRAY; the preprocess also accepts a
// wrapped { orders: [...] } so older payloads keep parsing.
export const MyOrdersSchema = z.preprocess(
  (value) => (Array.isArray(value) ? { orders: value } : (value ?? { orders: [] })),
  z.object({ orders: z.array(MyOrderSchema) })
);

export type StoreItem = z.infer<typeof StoreItemSchema>;
export type StoreOrder = z.infer<typeof StoreOrderSchema>;
export type MyOrder = z.infer<typeof MyOrderSchema>;

// Frontend-only: a glyph per category for items without artwork.
export const CATEGORY_GLYPH: Record<StoreCategory, string> = {
  app: "◍",
  product: "◈",
  service: "✎",
};
