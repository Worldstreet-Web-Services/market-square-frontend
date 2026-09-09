/**
 * The pure half of @-mention typing, shared by every box that takes a
 * mention: the post composer, the thread's comment box and the card's inline
 * reply. Kept free of React so the caret arithmetic — which is exactly the
 * part that goes wrong silently — is pinned by `lib/mention-token.test.ts`.
 */

/** The @-token the caret is inside, in text offsets. `query` is what follows the "@". */
export interface MentionToken {
  /** Offset of the "@" itself. */
  start: number;
  /** Offset of the caret — the end of what has been typed so far. */
  end: number;
  query: string;
}

/** Anything the picker inserts must satisfy this. */
export interface MentionLike {
  type: string;
  id: string;
  handle: string;
}

const TOKEN = /(?:^|\s)@([a-zA-Z0-9_-]*)$/;

/**
 * Is the caret sitting in an @-token?
 *
 * The "@" has to open a word — the start of the text or after whitespace — so
 * an email address or a mid-word "@" never opens the picker. A bare "@" is a
 * token with an EMPTY query: that is the moment a reader has just typed "@"
 * and expects to see people, which is why the empty query is not a "nothing
 * to search" state.
 */
export function mentionTokenAt(text: string, caret: number): MentionToken | null {
  const at = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, at);
  const match = TOKEN.exec(before);
  if (!match) return null;
  const query = match[1] ?? "";
  return { start: before.length - query.length - 1, end: before.length, query };
}

/**
 * Replace the token with "@handle " and say where the caret lands — after the
 * space, so the next words follow the mention without a keypress. Capped at
 * `max` characters like the field itself; the caret is clamped to the result.
 */
export function insertMentionAt(
  text: string,
  token: MentionToken,
  handle: string,
  max: number
): { text: string; caret: number } {
  const inserted = `@${handle} `;
  const next = `${text.slice(0, token.start)}${inserted}${text.slice(token.end)}`.slice(0, max);
  return { text: next, caret: Math.min(token.start + inserted.length, next.length) };
}

/**
 * Which picked mentions are still WRITTEN in the body. A handle can be edited
 * or deleted after it was picked, and a mention sent for someone no longer
 * named would tell them about a comment that does not mention them.
 */
export function mentionsPresentIn<T extends MentionLike>(picked: readonly T[], body: string): T[] {
  return picked.filter((mention) => new RegExp(`(^|\\s)@${escape(mention.handle)}\\b`).test(body));
}

/** Add a mention to the picked set once, keyed on type + id. */
export function addPicked<T extends MentionLike>(picked: readonly T[], mention: T): T[] {
  return picked.some((entry) => entry.type === mention.type && entry.id === mention.id)
    ? [...picked]
    : [...picked, mention];
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
