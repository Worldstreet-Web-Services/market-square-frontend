import type { Conversation } from "./types.ts";

/**
 * The chat inbox's four tabs — `All · Gists · Houses · Gist Requests`.
 *
 * They were drawn and inert because a conversation had no KIND and there was
 * no notion of a chat you had not agreed to, so three of the four could only
 * have shown everything or nothing. The service partitions on both now, so all
 * four are real.
 */
export type InboxTab = "all" | "gists" | "houses" | "requests";

/**
 * What each tab asks the SERVER for.
 *
 * Server-side, not a client-side slice of one list, and that is the whole
 * point: filtering a page we happened to have fetched would make "Houses" mean
 * "the groups among the last 30 conversations", which is a different and
 * quietly wrong statement. Each tab is its own query with its own cursor, so
 * paging inside a tab pages that tab.
 *
 * `state` is deliberately absent for the first three: the service defaults it
 * to `accepted`, and a pending request must never appear in the ordinary inbox
 * because a client forgot a parameter.
 */
export function tabQuery(tab: InboxTab): { kind?: "direct" | "group"; state?: "pending" } {
  if (tab === "gists") return { kind: "direct" };
  if (tab === "houses") return { kind: "group" };
  if (tab === "requests") return { state: "pending" };
  return {};
}

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
