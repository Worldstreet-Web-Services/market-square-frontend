import { z } from "zod";
import { ProfileSchema } from "@/lib/api/schemas";

/**
 * GET /search?q=&type=all|people|posts|streams|products&cursor&limit
 *
 * Results are MIXED: each item is discriminated by `kind` and carries that
 * entity's own payload rather than a flattened title/subtitle. A blank query
 * returns nothing — the service does not list everything for an empty `q`.
 */
const PostLikeSchema = z.object({
  id: z.string(),
  text: z.string().optional().default(""),
  mediaUrl: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
  author: ProfileSchema.nullable().optional().default(null),
});

export const SearchProfileResultSchema = z.object({
  kind: z.literal("profile"),
  // Top-level id mirrors the payload id; it is what the cursor pages over.
  id: z.string(),
  profile: ProfileSchema,
});

export const SearchPostResultSchema = z.object({
  kind: z.literal("post"),
  // Top-level id mirrors the payload id; it is what the cursor pages over.
  id: z.string(),
  post: PostLikeSchema,
});

export const SearchStreamResultSchema = z.object({
  kind: z.literal("stream"),
  // Top-level id mirrors the payload id; it is what the cursor pages over.
  id: z.string(),
  stream: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string().optional().default(""),
    category: z.string().nullable().optional().default(null),
    thumbnailUrl: z.string().nullable().optional().default(null),
    owner: ProfileSchema.nullable().optional().default(null),
  }),
});

export const SearchProductResultSchema = z.object({
  kind: z.literal("product"),
  // Top-level id mirrors the payload id; it is what the cursor pages over.
  id: z.string(),
  product: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    tagline: z.string().nullable().optional().default(null),
    category: z.string().nullable().optional().default(null),
    pricing: z.string().optional().default(""),
    thumbnailUrl: z.string().nullable().optional().default(null),
  }),
});

// An unknown future kind is dropped rather than failing the whole page.
export const SearchResultSchema = z.discriminatedUnion("kind", [
  SearchProfileResultSchema,
  SearchPostResultSchema,
  SearchStreamResultSchema,
  SearchProductResultSchema,
]);

export const DiscoverySchema = z.object({
  items: z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row) => {
      const parsed = SearchResultSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
  ),
  nextCursor: z.string().nullable().optional().default(null),
});

export const SEARCH_FILTERS = ["all", "people", "posts", "streams", "products"] as const;
export type SearchFilter = (typeof SEARCH_FILTERS)[number];

export type DiscoveryResult = z.infer<typeof SearchResultSchema>;

// GET /categories → a bare array. `count` is deliberately null for the
// categories other services own (real-world assets, prediction markets):
// that is "unknown", never zero.
export const CategorySchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number().nullable().optional().default(null),
});

export const CategoryListSchema = z.array(CategorySchema);
export type MarketCategory = z.infer<typeof CategorySchema>;
