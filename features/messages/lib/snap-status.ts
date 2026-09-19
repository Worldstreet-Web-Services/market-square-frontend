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
 * ─── THE STAMP, AND THE WATERMARK UNDER IT ───────────────────────────────────
 * The service stamps each message per person: `openedByMe`, and in a direct
 * conversation `openedByPeer`. Those are the truth and they are used wherever
 * they arrive.
 *
 * Where they do NOT arrive — a service that has not shipped them yet, an older
 * cached payload — the row falls back to the thread's read watermark
 * (`unreadCount`, `readByAll`), which answers a slightly different question:
 * has the reader been into this thread since the message arrived. That is an
 * approximation, and it is why the stamps outrank it rather than merely
 * agreeing with it. A missing stamp is never read as "not opened": it is read
 * as "no stamp here", and the watermark answers instead.
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
    /** Per-message stamps. Null means the payload carries none, not "no". */
    openedByMe?: boolean | null;
    openedByPeer?: boolean | null;
    /** A view-once snap, which the row names as one. */
    viewOnce?: boolean;
    /** Set once a snap has been opened and its file destroyed. */
    destroyedAt?: string | null;
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
  // Snapchat's own word, and the right one: a snap is not "a photo" in the
  // inbox, it is a thing that will be gone once looked at.
  const noun = last.viewOnce === true ? "Snap" : NOUN[kind];

  if (mine) {
    // The sender's half. The per-message stamp first; the thread watermark only
    // where there is no stamp. Neither absent value is read as "opened" —
    // telling somebody their message was opened when we do not know is the lie
    // that matters here.
    const opened = last.openedByPeer ?? last.readByAll === true;
    return {
      kind,
      state: opened ? "opened" : "delivered",
      label: opened ? "Opened" : "Delivered",
      filled: !opened,
    };
  }

  /*
    The reader's half, in order of how much each source actually knows:

      · DESTROYED outranks everything. A spent snap is spent for both ends, and
        the row must not offer "New Snap" for a file that no longer exists.
      · their own per-message stamp, where the service sends one;
      · otherwise the inbox's unread count, which answers the looser question
        of whether they have been into the thread since this arrived.
  */
  const unopened = last.destroyedAt
    ? false
    : last.openedByMe === null || last.openedByMe === undefined
      ? input.unreadCount > 0
      : !last.openedByMe;
  return {
    kind,
    state: unopened ? "new" : "opened",
    label: unopened ? `New ${noun}` : "Opened",
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
  /*
    A SNAP HAS A KIND AND NO URL, and that is deliberate on the service's part
    — a link on a read would be a way to see it without spending it. The
    ordinary picker needs a url before it will call something media, so
    without this a snap falls through to "chat" and the row says "New Chat"
    about a photo.
  */
  const typed = last.mediaKind?.trim().toLowerCase();
  if (typed?.startsWith("image")) return "photo";
  if (typed?.startsWith("video")) return "video";
  if (typed?.startsWith("audio")) return "voice";
  if (typed?.startsWith("file")) return "file";
  return "chat";
}
