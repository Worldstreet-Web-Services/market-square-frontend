/**
 * WHAT THE INBOX ROW SAYS ABOUT THE LAST THING IN A THREAD.
 *
 * Every attachment reads "Shared attachment" today, with one paperclip for a
 * photo, a clip, a voice note and a PDF alike. ogazboiz asked for Snapchat's
 * answer instead (2026-09-17, with a screenshot): a status you can read at a
 * glance, in colour, that says WHAT arrived and WHETHER it has been opened.
 *
 * ─── THE ONE RULE THAT MAKES IT WORK IN BOTH DIRECTIONS ──────────────────────
 * FILLED means "not opened yet". Hollow means "opened". That single rule reads
 * correctly whichever end of the conversation you are on:
 *
 *   · a message SENT TO the reader is filled until they open it — the thing
 *     they came to the inbox to find;
 *   · a message the reader SENT is filled until the other side opens it, which
 *     is the only thing the sender wants to know.
 *
 * It is Snapchat's rule, and it is why their inbox needs no words to be read.
 * We keep the words as well, because an icon alone is not accessible and the
 * colours carry meaning a screen reader cannot see.
 *
 * ─── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
 * No screenshot alerts. ogazboiz cut them himself ("exclude the screenshot
 * alerts first"), and they cannot be honestly implemented in a browser anyway:
 * a web page cannot detect a screenshot, so the feature would be a promise we
 * break silently on every desktop.
 *
 * No streaks. The rule for those is not defined yet, and counting days is the
 * service's job, not a thing to infer from one conversation row.
 *
 * ─── AND ONE APPROXIMATION, STATED RATHER THAN HIDDEN ────────────────────────
 * "Opened" here means the reader has been into the thread since the message
 * arrived — `unreadCount`, which the service counts per THREAD. Snapchat
 * stamps each message as opened individually. The difference shows in one
 * case: open a thread, do not scroll to the newest message, and this reads as
 * opened when strictly it was not. Closing that needs a per-viewer `openedAt`
 * on the message, which is a migration on the service and not a field rename.
 * Until then the row is honest about the thread, not about the message.
 *
 * Pure, so `lib/messages-snap-status.test.ts` pins it.
 */

import { messageMediaKind } from "./message-media.ts";

/** What arrived. `chat` is a plain text message — Snapchat's blue bubble. */
export type SnapKind = "photo" | "video" | "voice" | "file" | "chat";

/**
 * Where it has got to.
 *
 * `new` and `opened` are the reader's own view of something sent TO them;
 * `delivered` and `opened` describe something they sent. Four states, three
 * words, because "opened" means the same thing at both ends.
 */
export type SnapState = "new" | "opened" | "delivered";

export interface SnapStatus {
  kind: SnapKind;
  state: SnapState;
  /** The row's own words. Never the only carrier of meaning — see the colours. */
  label: string;
  /** True while it has not been opened: the glyph is solid rather than outlined. */
  filled: boolean;
}

export interface SnapStatusInput {
  /** The last message in the thread, or null for an empty one. */
  last: {
    text?: string | null;
    mediaUrl?: string | null;
    mediaKind?: string | null;
    status?: string | null;
    senderId?: string | null;
    /** The service's own answer to "has everyone else read this". */
    readByAll?: boolean;
  } | null;
  /** The reader, so the row knows which end of the conversation it is on. */
  meId?: string | null;
  /** Unread messages in this thread, as the inbox already counts them. */
  unreadCount: number;
}

const NOUN: Record<SnapKind, string> = {
  photo: "Photo",
  video: "Video",
  voice: "Voice note",
  file: "Attachment",
  chat: "Chat",
};

/**
 * The status for one conversation row, or null when there is nothing to say.
 *
 * Null for an empty thread and for a removed message: both already have their
 * own line in the row ("No messages yet", "Message removed"), and a status
 * badge on a message that no longer exists would be a claim about nothing.
 */
export function snapStatus(input: SnapStatusInput): SnapStatus | null {
  const last = input.last;
  if (!last) return null;
  if (last.status === "removed") return null;

  const kind = kindOf(last);
  const mine = Boolean(input.meId && last.senderId === input.meId);

  if (mine) {
    // The sender's half. `readByAll` is the SERVICE's answer, and an absent one
    // is read as "not yet" rather than as "opened" — telling somebody their
    // message was opened when we do not know is the lie that matters here.
    const opened = last.readByAll === true;
    return {
      kind,
      state: opened ? "opened" : "delivered",
      label: opened ? "Opened" : "Delivered",
      filled: !opened,
    };
  }

  // The reader's half. The inbox's own unread count is the truth about whether
  // they have been into this thread since it arrived.
  const unopened = input.unreadCount > 0;
  return {
    kind,
    state: unopened ? "new" : "opened",
    label: unopened ? `New ${NOUN[kind]}` : "Opened",
    filled: unopened,
  };
}

/**
 * Photo, clip, voice note, document or words.
 *
 * Media first: a photo WITH a caption is still a photo, which is what the
 * sender chose to send and what the reader will remember it as.
 */
function kindOf(last: NonNullable<SnapStatusInput["last"]>): SnapKind {
  const media = messageMediaKind({ mediaUrl: last.mediaUrl, mediaKind: last.mediaKind });
  if (media === "image") return "photo";
  if (media === "video") return "video";
  if (media === "audio") return "voice";
  if (media === "file") return "file";
  return "chat";
}
