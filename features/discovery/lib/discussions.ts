import { z } from "zod";
import { msApi } from "@/lib/api/service";

/**
 * Trending discussions: the tags people are actually posting in.
 *
 * Counts are OPTIONAL with no default. A deployment whose service predates
 * them must render nothing rather than a confident "0 discussing" — "this
 * payload has no count" and "nobody is here" are different claims, and
 * printing the second for the first is a lie a reader cannot detect. It is the
 * same rule every other tally on the square follows.
 */
export const TrendingDiscussionSchema = z.object({
  tag: z.string(),
  postCount: z.number().optional(),
  participantCount: z.number().optional(),
  viewCount: z.number().optional(),
});

export const TrendingDiscussionsSchema = z
  .object({ items: z.array(TrendingDiscussionSchema) })
  .transform((page) => page.items);

export type TrendingDiscussion = z.infer<typeof TrendingDiscussionSchema>;

export async function fetchTrendingDiscussions(limit = 6): Promise<TrendingDiscussion[]> {
  return TrendingDiscussionsSchema.parse(await msApi.get("/hashtags/trending", { limit }));
}
