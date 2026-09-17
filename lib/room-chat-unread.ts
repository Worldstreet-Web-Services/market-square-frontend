/**
 * UNREAD GISTROOM CHAT, for the phone's chat button.
 *
 * On a phone the room's chat is a sheet, so a message that arrives while it is
 * closed leaves no trace: the button looks the same whether somebody has just
 * said something or nobody has said anything all night (ogazboiz, 2026-09-17).
 * This counts what has arrived since the reader last had the chat open.
 *
 * ─── WHAT COUNTS ─────────────────────────────────────────────────────────────
 * Messages NEWER than the last one the reader saw, minus their own — a badge
 * for your own message is a badge for something you already read. Removed
 * messages (a host's moderation) are not unread either. The service returns a
 * page newest-first or oldest-first depending on the caller, so the order is
 * taken from `createdAt` rather than assumed, with the id as the tiebreak for
 * two messages in the same millisecond.
 *
 * ─── WHY A MARK, NOT A COUNTER ───────────────────────────────────────────────
 * The mark is the last message the reader saw, so the count survives a poll
 * that returns the same page, a refetch, a remount and a reconnect. A counter
 * incremented per poll cannot: it double-counts the same message the moment a
 * page is fetched twice.
 *
 * Pure, so `lib/room-chat-unread.test.ts` pins it.
 */

export interface RoomChatMessage {
  id: string;
  authorId?: string;
  status?: string;
  createdAt: string;
}

/** Sortable key for a message: time first, id as the tiebreak. */
function orderKey(message: RoomChatMessage): string {
  return `${message.createdAt}|${message.id}`;
}

/** The newest message in a page, or null for an empty one. */
export function newestRoomChat(messages: readonly RoomChatMessage[] | undefined): RoomChatMessage | null {
  if (!messages || messages.length === 0) return null;
  return messages.reduce((newest, message) => (orderKey(message) > orderKey(newest) ? message : newest));
}

/**
 * How many messages the reader has not seen.
 *
 * `seen` is the mark: the message they last had on screen, or null when they
 * have never opened the chat in this room — in which case the whole page is
 * unread, which is what a reader joining a room in progress should see.
 */
export function unreadRoomChat(
  messages: readonly RoomChatMessage[] | undefined,
  seen: RoomChatMessage | null,
  myUserId: string | null | undefined
): number {
  if (!messages || messages.length === 0) return 0;
  const mark = seen ? orderKey(seen) : "";
  return messages.filter(
    (message) =>
      orderKey(message) > mark &&
      (message.status ?? "active") === "active" &&
      (!myUserId || message.authorId !== myUserId)
  ).length;
}

/** The badge's text: past nine it reads "9+" rather than shrinking the type. */
export function roomChatBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

/** What the control is called, so the count is spoken rather than only seen. */
export function roomChatLabel(count: number): string {
  if (count <= 0) return "Open the gistroom chat";
  return count === 1 ? "Open the gistroom chat, 1 new message" : `Open the gistroom chat, ${count} new messages`;
}
