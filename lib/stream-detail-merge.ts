/**
 * A MUTATION'S STREAM, MERGED INTO THE DETAIL CACHE WITHOUT LOSING PRIVACY.
 *
 * `["ms","stream",id]` is the detail `GET /streams/:id` fills, and it is the
 * only payload that carries the house doorplate. go-live and a stream update
 * answer with a Stream that has `house: null` and an `audience` defaulted to
 * public when the field is absent, and writing that over the detail made a
 * private house room read as a public room — which is what the lock screen,
 * the room header and the code chip all read. The facts the payload cannot be
 * trusted to carry are kept from the cache; the next poll replaces the whole
 * entry with the real detail.
 *
 * Pure, pinned in lib/room-session.test.ts.
 */
interface DetailPrivacy {
  audience?: string;
  houseConversationId?: string | null;
  house?: unknown;
}

export function mergeStreamDetail<T extends DetailPrivacy>(old: T | undefined, next: T): T {
  if (!old) return next;
  return {
    ...old,
    ...next,
    house: next.house ?? old.house,
    houseConversationId: next.houseConversationId ?? old.houseConversationId,
    // Only ever narrowed by a payload: a private room stays private until the
    // detail itself says otherwise.
    audience: old.audience === "private" || next.audience === "private" ? "private" : next.audience,
  };
}
