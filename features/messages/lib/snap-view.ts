/**
 * A SNAP: SEEN ONCE, THEN GONE.
 *
 * ogazboiz settled the semantics on 2026-09-19: view-once, destroyed on
 * opening rather than after a window, and only the photos and clips the sender
 * marks — a gallery photo stays in the thread like any other.
 *
 * ─── THE RULE THE WHOLE FEATURE RESTS ON ─────────────────────────────────────
 * A READ NEVER CARRIES A WAY TO SEE A SNAP. On the thread, in the inbox
 * preview, and in the sender's own send response, the media object arrives
 * with its kind and its size but NO url. That is not a broken payload — it is
 * the point. A link on a read would be a way to see a snap without spending
 * it, which is the one thing view-once has to prevent, and no amount of care
 * in the UI can put that back once the URL is in the page.
 *
 * So the bubble never has a picture to draw. It draws a state instead, and the
 * single url that exists in the world comes back from the open route, once,
 * and is held in memory for as long as the viewer is on screen. It is never
 * written to the query cache, never persisted, and never re-requested — a
 * second open answers `{destroyed: true, media: null}`.
 *
 * ─── WHY OPENING IS A DELIBERATE TAP ─────────────────────────────────────────
 * Nothing opens on scroll. Opening destroys the file five minutes later, so it
 * must be an act, not a side effect of the thread being on screen — a snap
 * consumed by a scroll past it is a snap the reader never saw.
 *
 * Pure, so `lib/messages-snap-view.test.ts` pins it.
 */

/** What the bubble says. */
export type SnapViewState =
  /** Theirs, unopened: the tap that spends it. */
  | "unopened"
  /** Theirs, already opened: the file is gone. */
  | "spent"
  /** Mine, they have not opened it yet. */
  | "delivered"
  /** Mine, they have opened it. */
  | "seen";

export interface SnapView {
  state: SnapViewState;
  /** Photo or clip — the two kinds a snap may be. */
  kind: "photo" | "video";
  /** The bubble's words. Carries the meaning; the icon never carries it alone. */
  label: string;
  /** True only where a tap would open it: theirs, unopened. */
  openable: boolean;
  /**
   * WHICH DOOR IT CAME THROUGH, for the reader who is about to spend it.
   *
   * ogazboiz, 2026-09-19: "if it is from media the snap you will know it is
   * from media, if it is from like live camera you will know the snap". A
   * photo taken in the moment and a photo chosen from a gallery ask to be read
   * differently, and only the sender's client knew which — so the service now
   * carries it.
   *
   * Null where the payload says nothing, which is every message sent before
   * the field existed. Null draws NO mark rather than guessing "upload": the
   * honest answer to "which door" is sometimes "we were not told".
   */
  source: "camera" | "upload" | null;
  /** The words for that mark, or null when there is no mark to draw. */
  sourceLabel: string | null;
}

/** The reader, as whichever of the two facts the caller already holds. */
export type SnapViewer = { mine: boolean } | { meId: string | null | undefined };

export interface SnapMessageFields {
  viewOnce?: boolean;
  mediaSource?: "camera" | "upload" | null;
  mediaKind?: string | null;
  senderId?: string | null;
  openedByMe?: boolean | null;
  openedByPeer?: boolean | null;
  destroyedAt?: string | null;
}

/** Is this message a snap at all? Everything else renders the ordinary way. */
export function isSnap(message: SnapMessageFields): boolean {
  return message.viewOnce === true;
}

/**
 * What to draw for a snap, or null when the message is not one.
 *
 * `destroyedAt` outranks the reader's own stamp: the service has destroyed the
 * file, so there is nothing to open however this browser remembers it.
 */
export function snapView(message: SnapMessageFields, viewer: SnapViewer): SnapView | null {
  if (!isSnap(message)) return null;

  const kind = message.mediaKind === "video" ? "video" : "photo";
  const noun = kind === "video" ? "Video" : "Photo";
  const source = message.mediaSource ?? null;
  const sourceLabel = source === "camera" ? "Camera" : source === "upload" ? "From gallery" : null;
  // Whichever the caller has to hand: the thread already knows `mine`, the
  // inbox row only has the reader's id. Neither is inferred from the other.
  const mine =
    "mine" in viewer ? viewer.mine : Boolean(viewer.meId && message.senderId === viewer.meId);

  if (mine) {
    // The sender never opens their own — the service refuses it — so this end
    // only ever reports on the other side.
    const seen = message.openedByPeer === true || Boolean(message.destroyedAt);
    return {
      state: seen ? "seen" : "delivered",
      kind,
      label: seen ? "Opened" : "Delivered",
      openable: false,
      source,
      sourceLabel,
    };
  }

  const spent = Boolean(message.destroyedAt) || message.openedByMe === true;
  return {
    state: spent ? "spent" : "unopened",
    kind,
    label: spent ? "Opened" : `Tap to view ${noun.toLowerCase()}`,
    openable: !spent,
    source,
    sourceLabel,
  };
}

/**
 * May this attachment be sent as a snap?
 *
 * Two refusals, and both are the SERVICE's rules restated so the control is
 * absent rather than offered-then-refused:
 *
 *   · DIRECT CONVERSATIONS ONLY. In a group, whoever opened it first would
 *     destroy it for everybody else — the feature does not mean anything there.
 *   · PHOTO OR CLIP ONLY. A view-once voice note or PDF is not a thing we
 *     have designed, so it is not a thing the toggle offers.
 */
export function canSendSnap(input: {
  conversationKind: "direct" | "group" | string;
  mediaKind: string | null | undefined;
}): boolean {
  if (input.conversationKind !== "direct") return false;
  return input.mediaKind === "image" || input.mediaKind === "video";
}

/**
 * How long is left before the file is DELETED, in milliseconds.
 *
 * The open response carries `mediaExpiresAt` — the exact instant, which the
 * service alone knows (`SNAP_MEDIA_HOLD_SECONDS`, five minutes today). At zero
 * there is nothing behind the url and no retry that could work, so the viewer
 * closes rather than sitting on a picture that has stopped loading.
 *
 * Null means "no deadline given": a second open, or a payload from a service
 * that does not send one. The viewer then stays until the reader closes it,
 * which is the old behaviour and better than closing on a guessed clock.
 */
export function snapTimeLeft(mediaExpiresAt: string | null | undefined, now: number): number | null {
  if (!mediaExpiresAt) return null;
  const deadline = Date.parse(mediaExpiresAt);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, deadline - now);
}
