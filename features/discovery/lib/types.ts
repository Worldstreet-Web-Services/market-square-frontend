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
  // The backend types its own media; a video result opens the immersive
  // viewer rather than the permalink, and `isVideoPost` needs this to say so
  // without sniffing the URL's extension.
  mediaKind: z.string().nullable().optional().default(null),
  thumbnailUrl: z.string().nullable().optional().default(null),
  createdAt: z.string().optional().default(""),
  // Tallies carry NO default on purpose. `undefined` means "this payload does
  // not carry the count", which is not "zero" — the slide renders nothing at
  // all rather than a fabricated 0. /search does return them today; this stays
  // honest if a future response stops.
  likeCount: z.number().optional(),
  commentCount: z.number().optional(),
  likedByMe: z.boolean().optional(),
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

/**
 * What `?topics=` actually did to this response.
 *
 * The service returns this whenever a topic filter is active, and it is
 * deliberate: topics cannot apply to PEOPLE (a person is not filed under a
 * topic), so people are excluded from the filter rather than silently
 * returning nothing. Without surfacing it, a reader who filtered by a topic
 * and saw no creators would conclude there were none — the field exists so the
 * UI can say "topics do not apply here" instead.
 */
export const TopicFilterSchema = z.object({
  topics: z.array(z.string()).optional().default([]),
  appliedTo: z.array(z.string()).optional().default([]),
  excluded: z.array(z.string()).optional().default([]),
});

export const DiscoverySchema = z.object({
  items: z.array(z.unknown()).transform((rows) =>
    rows.flatMap((row) => {
      const parsed = SearchResultSchema.safeParse(row);
      return parsed.success ? [parsed.data] : [];
    })
  ),
  nextCursor: z.string().nullable().optional().default(null),
  // Absent when no topic filter was applied — null is "the question did not
  // arise", not "nothing was excluded".
  topicFilter: TopicFilterSchema.nullable().optional().default(null),
});

export type TopicFilter = z.infer<typeof TopicFilterSchema>;

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

/**
 * GET /topics — the canonical vocabulary.
 *
 * The picker renders from this, never from a list in the component: adding a
 * topic is then a backend change alone, with no frontend deploy.
 */
export const TopicSchema = z.object({
  key: z.string(),
  label: z.string(),
  /**
   * The backend's own ordering. Sort by it EXPLICITLY rather than trusting the
   * order the array happens to arrive in — incidental array order is exactly
   * the assumption that breaks the day somebody inserts a topic in the middle.
   * Defaulted high so a topic shipped without one sorts last instead of
   * jumping to the front of the row.
   */
  sortOrder: z.number().optional().default(Number.MAX_SAFE_INTEGER),
});

export const TopicListSchema = z.array(TopicSchema);

/** GET|PUT /me/interests */
export const InterestsSchema = z.object({
  topics: z.array(z.string()).optional().default([]),
});

export type Topic = z.infer<typeof TopicSchema>;

/**
 * GET /profiles — the people directory.
 *
 * PROVISIONAL CONTRACT, pending backend. Explore's People tab must be
 * populated on arrival, and nothing today can do that: `/search?type=people`
 * deliberately returns nothing for a blank `q`, `/spotlight` is a short ranked
 * leaderboard rather than a directory, and `/admin/profiles` — which has
 * exactly the right shape — is admin-only and so unusable for a signed-out
 * discovery surface.
 *
 * Until it ships, `GET /profiles` 404s and the tab says so quietly (the same
 * "not deployed, not broken" handling `useTopics` and the Arkmark control
 * use). It then lights up on its own with no frontend deploy.
 *
 * `q` narrows the SAME list rather than switching to `/search`, so browsing
 * and searching people share one list and one cursor instead of two that
 * page differently.
 */
export const PeoplePageSchema = z.object({
  items: z.array(ProfileSchema),
  nextCursor: z.string().nullable().optional().default(null),
});

export type PeoplePage = z.infer<typeof PeoplePageSchema>;
