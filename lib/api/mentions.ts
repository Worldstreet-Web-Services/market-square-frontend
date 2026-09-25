import { z } from "zod";
import { msApi } from "@/lib/api/service";
import { MentionSchema, type Mention } from "@/lib/api/schemas";

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

/**
 * RESOLVE THE @HANDLES SOMEBODY TYPED, for a field with no picker.
 *
 * A bio and a house description are written in a plain textarea — there is no
 * autocomplete to remember who was chosen, so the handles in the text are all
 * we have. This asks the directory for each one and keeps only an EXACT,
 * case-insensitive match.
 *
 * EXACT ONLY, and that is the whole safety of it. `/mentions/search` answers
 * the top eight for a prefix, so "@ada" comes back with adaeze and adaobi —
 * taking the first would tag a stranger who happens to sort early, and tag
 * them permanently on somebody's profile. Better to leave "@ada" as plain
 * text than to link it to the wrong person.
 *
 * Unresolvable handles simply stay text, which is exactly how X behaves for a
 * handle that does not exist.
 */
export async function resolveHandles(text: string): Promise<Mention[]> {
  const handles = [...new Set(Array.from(text.matchAll(/(?:^|\s)@([A-Za-z0-9_.]{1,30})\b/g), (m) => m[1]))];
  if (handles.length === 0) return [];
  const found = await Promise.all(
    handles.map(async (handle) => {
      try {
        const { items } = await searchMentions(handle);
        return (
          items.find(
            (item) => item.type === "profile" && item.handle.toLowerCase() === handle.toLowerCase()
          ) ?? null
        );
      } catch {
        // A directory that will not answer must not block a save. The handle
        // stays plain text and the rest of the bio is written as typed.
        return null;
      }
    })
  );
  return found.filter((m): m is Mention => m !== null);
}
