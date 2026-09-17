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
  title: string;
}

export function serializeRejoin(record: RejoinRecord): string {
  return JSON.stringify({ streamId: record.streamId, title: record.title });
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
  const { streamId, title } = value as Record<string, unknown>;
  if (typeof streamId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(streamId)) return null;
  return { streamId, title: typeof title === "string" ? title.slice(0, 200) : "" };
}
