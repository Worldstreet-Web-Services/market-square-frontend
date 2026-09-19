/**
 * Turns what the composer holds into the body `POST /conversations/:id/messages`
 * accepts.
 *
 * Pure and free of `@/` aliases so it runs under `node --test`, matching the
 * other halves of this slice (`message-media`, `read-receipt`, `waveform`).
 *
 * The rules it encodes are all rules the SERVICE enforces, and each one is a
 * 400 if we get it wrong:
 *
 *  - A message carries text, media, or both — never neither.
 *  - An empty or whitespace-only caption is NOT text. Sending `text: ""`
 *    beside a photo would be a body the service rejects for a caption the user
 *    never wrote.
 *  - Measurements are positive integers or absent. `width: 0` from a decode
 *    that failed is not "unknown", it is invalid — and "not measured" is the
 *    honest thing to send, which the service stores as null.
 *  - There is no `kind`: the service derives it from the object it stored, so
 *    a client cannot label a clip as a voice note.
 */

export interface OutgoingMedia {
  /**
   * The stored object's key, for an attachment the service keeps PRIVATE.
   *
   * A private object has no URL the sender could hand back — the service mints
   * a signed link per read instead — so the key is what identifies it. Empty
   * or absent means an upload from before private storage, which still
   * identifies itself by `url`; the service accepts exactly one of the two and
   * prefers the key.
   */
  key?: string;
  /**
   * Which door this came through — the live camera, or a file the sender
   * already had. A LABEL, never a permission: it is a client claim the service
   * cannot verify, so nothing is ever gated on it.
   */
  source?: "camera" | "upload";
  url: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  /**
   * Files only: the name the reader picked, so the bubble can say what it is.
   *
   * The service sanitises it and forces the stored object's real extension, so
   * it is display text that can never become a storage key. Sent only when it
   * survives trimming — a whitespace name is not a name, and an empty string
   * would be a caption the user never wrote.
   */
  fileName?: string | null;
  /** Files only: the size, so the bubble can show it without fetching bytes. */
  sizeBytes?: number | null;
}

/**
 * The `Mention` a picker records — structurally the shape in
 * `lib/api/schemas.ts` (`MentionSchema`), spelled here so this file stays
 * alias-free for `node --test`.
 */
export interface OutgoingMention {
  type: "profile" | "group";
  id: string;
  label: string;
  handle: string;
}

/** The service caps `mentions` at 25 per message. */
export const MENTIONS_MAX = 25;

export interface OutgoingMessage {
  /**
   * Send this attachment as a SNAP: seen once, then destroyed.
   *
   * Only ever true for a photo or a clip in a one-to-one — `canSendSnap` holds
   * that rule, and the service refuses anything else with a 400.
   */
  viewOnce?: boolean;
  text?: string;
  media?: OutgoingMedia;
  /** The message being answered — an id in the SAME conversation, one level. */
  replyToId?: string | null;
  /** Who the picker meant; handles typed in `text` are resolved server-side too. */
  mentions?: OutgoingMention[];
}

export interface MessagePayload {
  viewOnce?: boolean;
  mediaSource?: "camera" | "upload";
  text?: string;
  media?: {
    key?: string;
    url?: string;
    width?: number;
    height?: number;
    durationSeconds?: number;
    fileName?: string;
    sizeBytes?: number;
  };
  replyToId?: string;
  mentions?: OutgoingMention[];
}

/** A positive, finite integer, or undefined — the shape the service accepts. */
function measurement(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

export function buildMessagePayload(body: OutgoingMessage): MessagePayload {
  const payload: MessagePayload = {};
  const text = body.text?.trim();
  if (text) payload.text = text;

  const mediaKey = body.media?.key?.trim();
  if (body.media && (mediaKey || body.media.url)) {
    const width = measurement(body.media.width);
    const height = measurement(body.media.height);
    // A sub-second clip still has a duration; the service's floor is 1.
    const raw = body.media.durationSeconds;
    const duration =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.max(1, Math.round(raw))
        : undefined;
    const fileName = body.media.fileName?.trim();
    const sizeBytes = measurement(body.media.sizeBytes);
    payload.media = {
      // EXACTLY ONE of the two, never both: the service takes the key when it
      // is sent, and sending a stale URL beside it would only be a second
      // claim about the same object. The URL remains the whole story for an
      // upload the service answered without a key.
      ...(mediaKey ? { key: mediaKey } : { url: body.media.url }),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(duration ? { durationSeconds: duration } : {}),
      ...(fileName ? { fileName } : {}),
      ...(sizeBytes ? { sizeBytes } : {}),
    };
  }

  // TOP LEVEL, beside viewOnce rather than inside media: the service stores it
  // on the message so it outlives a destroyed snap. Omitted for a picked file,
  // since absent already means "upload" there and is stored as such.
  if (body.media?.source === "camera" && payload.media) payload.mediaSource = "camera";

  // OMITTED unless true. `viewOnce: false` says nothing an absent field does
  // not, and it must never travel on a message with no media: a view-once line
  // of text is not a thing, and the service would refuse the message outright.
  if (body.viewOnce && payload.media) payload.viewOnce = true;

  // Both are OMITTED rather than sent empty: `replyToId: null` and
  // `mentions: []` say nothing the absent field does not, and an id that is
  // only whitespace is not a reply.
  const replyToId = body.replyToId?.trim();
  if (replyToId) payload.replyToId = replyToId;
  if (body.mentions && body.mentions.length > 0) payload.mentions = body.mentions.slice(0, MENTIONS_MAX);
  return payload;
}

/** Whether there is anything to send at all — what enables the send button. */
export function canSendMessage(body: OutgoingMessage): boolean {
  const payload = buildMessagePayload(body);
  return payload.text !== undefined || payload.media !== undefined;
}
