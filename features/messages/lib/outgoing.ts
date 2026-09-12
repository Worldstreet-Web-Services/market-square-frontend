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
  url: string;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}

export interface OutgoingMessage {
  text?: string;
  media?: OutgoingMedia;
}

export interface MessagePayload {
  text?: string;
  media?: { url: string; width?: number; height?: number; durationSeconds?: number };
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

  if (body.media?.url) {
    const width = measurement(body.media.width);
    const height = measurement(body.media.height);
    // A sub-second clip still has a duration; the service's floor is 1.
    const raw = body.media.durationSeconds;
    const duration =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.max(1, Math.round(raw))
        : undefined;
    payload.media = {
      url: body.media.url,
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(duration ? { durationSeconds: duration } : {}),
    };
  }
  return payload;
}

/** Whether there is anything to send at all — what enables the send button. */
export function canSendMessage(body: OutgoingMessage): boolean {
  const payload = buildMessagePayload(body);
  return payload.text !== undefined || payload.media !== undefined;
}
