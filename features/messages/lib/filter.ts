import type { Conversation } from "./types.ts";

/**
 * Does this conversation match what was typed?
 *
 * Peer name, handle and the last message's text — the three things a person
 * has actually read and might search for. Case-insensitive, trimmed, and an
 * empty query matches everything rather than nothing, so clearing the box
 * restores the list instead of emptying it.
 *
 * Client-side ON PURPOSE, and only over what has been paged in: the service
 * has no conversation search, and a box that silently searches one page while
 * looking like it searches all of them is worse than one that says so. The
 * inbox is small enough that this is honest today; the day it is not, this is
 * the function that becomes a request.
 */
export function matchesQuery(conversation: Conversation, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const peer = conversation.peer;
  const haystacks = [peer?.displayName, peer?.username, conversation.lastMessage?.text];
  return haystacks.some((value) => value?.toLowerCase().includes(needle));
}

/** The rows the inbox should draw, after the filter chip and the search box. */
export function visibleConversations<T extends Conversation>(
  conversations: T[],
  filter: "all" | "unread",
  query: string
): T[] {
  return conversations.filter(
    (conversation) =>
      (filter === "all" || conversation.unreadCount > 0) && matchesQuery(conversation, query)
  );
}
