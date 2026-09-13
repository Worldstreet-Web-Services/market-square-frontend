import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { MentionSchema } from "@/lib/api/schemas";

/**
 * `GET /mentions/search` — the candidates for an @-token.
 *
 * Slice-free on purpose: the post composer, the comment boxes AND the chat
 * composer all type mentions, and slices never import each other, so the
 * fetcher lives beside the other cross-cutting api pieces rather than in the
 * feed slice it started in (`features/feed/lib/api.ts` re-exports it).
 *
 * The BFF answers this itself — it rewrites onto `/search?type=people` and
 * reshapes — which is why it sits in `BFF_HANDLED` for the route check.
 */
const MentionSearchSchema = z.object({ items: z.array(MentionSchema) });

export type MentionSearchResult = z.infer<typeof MentionSearchSchema>;

export async function searchMentions(query: string) {
  return MentionSearchSchema.parse(await msApi.get("/mentions/search", { q: query.trim(), limit: 8 }));
}
