/**
 * Who a thread is with, and when they were last here.
 *
 * The header of node 21:5519 reads `Fatima B.` over `@fatima.b • Active 20m
 * ago`; node 21:6024 reads `Naija Tech Bros in Diaspora` over `75 members •
 * Active 3d ago`. Same two lines, two different sources, and the difference is
 * `kind` — which is exactly the sort of branch that turns into four inline
 * ternaries inside JSX and then quietly disagrees with itself between the
 * header, the empty state and the aria-label.
 *
 * So it is one pure function per line, tested, and the view only renders what
 * comes back. Everything here can answer NULL, and null means "render nothing"
 * — never a placeholder. A conversation with no presence timestamp shows the
 * handle alone; it does not show "Active recently", which is a claim the
 * payload never made.
 */

/** The identity fields the header needs, structurally — not the whole
    `Conversation`, so a test can hand it a literal. */
export interface ThreadPeer {
  displayName: string;
  username: string;
  lastSeenAt?: string | null;
}

export interface ThreadIdentity {
  kind: "direct" | "group";
  title?: string | null;
  peer?: ThreadPeer | null;
  members?: ThreadPeer[];
  memberCount?: number | null;
  lastActiveAt?: string | null;
}

export function isGroupThread(conversation: Pick<ThreadIdentity, "kind">): boolean {
  return conversation.kind === "group";
}

/**
 * The header's first line.
 *
 * A group's own `title` wins. With no title the service still sends up to four
 * `members`, and their names ARE the group as far as the reader is concerned —
 * that is the fallback WhatsApp, Signal and iMessage all use, and it is real
 * data rather than an invented label. Only when there is neither does it fall
 * back to a generic word, because a header with no text at all reads as a
 * failed load.
 */
export function threadTitle(conversation: ThreadIdentity): string {
  if (isGroupThread(conversation)) {
    const named = conversation.title?.trim();
    if (named) return named;

    const names = (conversation.members ?? [])
      .map((member) => member.displayName?.trim())
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) return names.join(", ");

    return "Group chat";
  }

  return conversation.peer?.displayName?.trim() || "Conversation";
}

/**
 * `Active 20m ago`.
 *
 * Single-letter units, matching the inbox stamp for the same reason: this line
 * shares 703px with a handle and has to survive a long one.
 *
 * PAST A MONTH IT ANSWERS NULL rather than "Active 3mo ago". "Active" is a
 * presence signal, and presence stops being news long before it stops being
 * computable — a header announcing that somebody was around last spring is
 * noise where the handle is information. The subtitle simply loses its second
 * half.
 *
 * `now` is injectable so every boundary is pinned rather than trusted to the
 * host clock.
 */
export function lastActiveLabel(
  iso: string | null | undefined,
  now: number = Date.now()
): string | null {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;

  // A timestamp in the future is clock skew between us and the service, not a
  // prediction. "Active now" is the least wrong reading of it.
  const elapsed = Math.max(0, now - at);

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Active now";
  if (minutes < 60) return `Active ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Active ${weeks}w ago`;

  return null;
}

/**
 * `75 members`.
 *
 * Null for an absent count, because the schema deliberately does not default
 * it to 0 — "this payload does not count members" and "this group is empty"
 * are different statements and only one of them is ever true.
 */
export function memberCountLabel(count: number | null | undefined): string | null {
  if (count === null || count === undefined) return null;
  if (!Number.isFinite(count) || count < 0) return null;
  const whole = Math.floor(count);
  return `${whole} ${whole === 1 ? "member" : "members"}`;
}

/**
 * The header's second line, as its parts.
 *
 * Parts rather than a joined string so the view owns the separator — the file
 * sets it as a bulleted gap, and a component that receives "a • b" cannot
 * space it the way the design does. Empty array means the line is not drawn at
 * all.
 */
export function threadSubtitleParts(
  conversation: ThreadIdentity,
  now: number = Date.now()
): string[] {
  if (isGroupThread(conversation)) {
    return [
      memberCountLabel(conversation.memberCount),
      lastActiveLabel(conversation.lastActiveAt, now),
    ].filter((part): part is string => Boolean(part));
  }

  const peer = conversation.peer;
  return [
    peer?.username ? `@${peer.username}` : null,
    lastActiveLabel(peer?.lastSeenAt, now),
  ].filter((part): part is string => Boolean(part));
}
