/**
 * What a quoted message says in one line.
 *
 * Two places draw a quote of another message: the "Replying to …" strip above
 * the chat composer (from a LOADED message the reader tapped) and the quote
 * inside a bubble (from the service's `replyTo`, which already carries a
 * 140-character excerpt). Both go through this one rule so a photo reads
 * "Photo" in the strip and in the bubble, and a deleted original reads
 * "Message deleted" in both.
 *
 * Pure and alias-free so `node --test` runs it (`lib/message-reply.test.ts`).
 */

/** The service's own excerpt length; the strip is cut to the same number. */
export const REPLY_EXCERPT_MAX = 140;

/** The parts of a message a quote needs — the wire `replyTo`, or a loaded
    `Message` reduced to the same shape. */
export interface ReplySource {
  text?: string | null;
  /** The wire shape: null for no attachment, `{ kind }` for one — `image` |
      `video` | `audio`, or a null kind for media the service could not type. */
  media?: { kind?: string | null } | null;
  deleted?: boolean;
}

/** The one-word name for an attachment with no caption. */
export function mediaLabel(kind: string | null | undefined): string {
  const typed = kind?.trim().toLowerCase() ?? "";
  if (typed.startsWith("image")) return "Photo";
  if (typed.startsWith("video")) return "Video";
  if (typed.startsWith("audio")) return "Voice note";
  return "Attachment";
}

/**
 * The quote's line. Deleted wins over everything; then the text on one line,
 * cut with an ellipsis past `max`; then the attachment's name; then nothing —
 * an empty string, so the caller draws no second line rather than a
 * placeholder the message never said.
 */
export function replyExcerpt(source: ReplySource, max: number = REPLY_EXCERPT_MAX): string {
  if (source.deleted) return "Message deleted";
  const text = (source.text ?? "").replace(/\s+/g, " ").trim();
  if (text) {
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  }
  if (source.media) return mediaLabel(source.media.kind);
  return "";
}

/** Whether the quote has anything to draw at all. */
export function hasQuote(source: ReplySource | null | undefined): boolean {
  return Boolean(source) && replyExcerpt(source as ReplySource).length > 0;
}
