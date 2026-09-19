/**
 * "TAP TO REJOIN" AFTER A RELOAD.
 *
 * A reload is a new page: the session starts idle and nobody's call is resumed
 * without them — never a speaker's or a host's open mic, and not a listener's
 * audio either, because the browser will not play it without a gesture. So
 * the room the tab was in is remembered in sessionStorage (this tab only), and
 * the mini-player offers it back as a chip. Written while a room is held,
 * cleared by every explicit end (leave, close, hang-up, logout, dismiss) and by
 * the room ending — but NOT by tab close, which is exactly the reload case.
 *
 * Pure: the parse is hostile-input safe and pinned in lib/room-session.test.ts.
 */
export const REJOIN_KEY = "ms:room-session";

export interface RejoinRecord {
  streamId: string;
  /** The name to show. A private room is stored as the neutral "Gist room". */
  title: string;
  /** The account that was in the room. The offer is theirs alone. */
  userId: string | null;
}

export function serializeRejoin(record: RejoinRecord): string {
  return JSON.stringify({ streamId: record.streamId, title: record.title, userId: record.userId });
}

/**
 * WHOSE OFFER IS IT? sessionStorage outlives a sign-out the tab never saw (a
 * session that expired while the laptop was shut, a sign-out on another
 * device), so the chip was shown to a signed-out screen — and to the next
 * account signed into that tab — naming the previous account's room. It is
 * offered only once auth has settled signed in, to the account that wrote it.
 */
export function rejoinOfferFor({
  record,
  authReady,
  authenticated,
  meId,
}: {
  record: RejoinRecord | null;
  authReady: boolean;
  authenticated: boolean;
  meId: string | null;
}): RejoinRecord | null {
  if (!record || !authReady || !authenticated || !meId) return null;
  return record.userId === meId ? record : null;
}

export function parseRejoin(raw: string | null): RejoinRecord | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { streamId, title, userId } = value as Record<string, unknown>;
  if (typeof streamId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(streamId)) return null;
  return {
    streamId,
    title: typeof title === "string" ? title.slice(0, 200) : "",
    userId: typeof userId === "string" && userId.length <= 200 ? userId : null,
  };
}
