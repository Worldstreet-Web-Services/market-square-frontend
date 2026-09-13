import type { Mention } from "@/lib/api/schemas";

/**
 * Who a chat composer may @-mention: MEMBERS of the conversation, nobody
 * else. The service drops a non-member mention on its own; this is what
 * keeps the picker from offering one in the first place.
 *
 * Two sources feed the list, and both are needed:
 *
 *  - `GET /mentions/search` answers the directory's top eight for the query.
 *    Filtered to the member set it is right when it hits — but in a house of
 *    seventy-five, or a 1:1 with somebody whose name is common, the eight can
 *    miss every member, and a list that says "nobody" in a room full of
 *    people reads as broken.
 *  - The roster the thread already holds (the peer on a 1:1; the summary's
 *    four-deep preview plus the full `GET /conversations/:id/members` on a
 *    group) is matched locally on handle and name, so a member always
 *    surfaces the moment their handle or name starts with what was typed.
 *
 * Server rows lead (they carry the service's own label), local matches fill
 * in behind them, deduplicated on id, the reader excluded, capped at eight
 * like the search itself. Pure; pinned by `lib/mentionable-members.test.ts`.
 */

export interface MentionableMember {
  id: string;
  displayName: string;
  username: string;
}

export const MENTION_LIST_MAX = 8;

/** A roster row as the picker's `Mention` — the same shape a post sends. */
export function memberMention(member: MentionableMember): Mention {
  return { type: "profile", id: member.id, label: member.displayName, handle: member.username };
}

/** Does this member answer the query? A bare query matches everybody. */
function matches(member: MentionableMember, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const handle = member.username.toLowerCase();
  const name = member.displayName.toLowerCase();
  return handle.startsWith(q) || name.startsWith(q) || name.split(/\s+/).some((word) => word.startsWith(q));
}

/** The roster's own answer to the query, as mentions. Handle matches first. */
export function mentionableMembers(
  members: readonly MentionableMember[],
  query: string,
  exclude?: string | null
): Mention[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const rows: { mention: Mention; rank: number }[] = [];
  for (const member of members) {
    if (!member.id || member.id === exclude || seen.has(member.id)) continue;
    if (!matches(member, q)) continue;
    seen.add(member.id);
    rows.push({ mention: memberMention(member), rank: member.username.toLowerCase().startsWith(q) ? 0 : 1 });
  }
  return rows.sort((a, b) => a.rank - b.rank).map((row) => row.mention);
}

/**
 * The picker's rows for a chat composer: the server's rows that are members,
 * then the roster's own matches the server did not return.
 */
export function mentionCandidates({
  found,
  members,
  query,
  exclude,
  max = MENTION_LIST_MAX,
}: {
  /** What `GET /mentions/search` answered. */
  found: readonly Mention[];
  members: readonly MentionableMember[];
  query: string;
  /** The reader's own id — you cannot mention yourself. */
  exclude?: string | null;
  max?: number;
}): Mention[] {
  const memberIds = new Set(members.map((member) => member.id));
  const out: Mention[] = [];
  const seen = new Set<string>();
  for (const mention of found) {
    if (mention.type !== "profile" || !memberIds.has(mention.id) || mention.id === exclude) continue;
    if (seen.has(mention.id)) continue;
    seen.add(mention.id);
    out.push(mention);
  }
  for (const mention of mentionableMembers(members, query, exclude)) {
    if (seen.has(mention.id)) continue;
    seen.add(mention.id);
    out.push(mention);
  }
  return out.slice(0, max);
}
