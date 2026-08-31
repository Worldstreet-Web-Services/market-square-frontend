/**
 * The story viewer's clock, traversal and audio rules.
 *
 * All of this used to live inside `StoryViewer` as inline arithmetic and
 * ternaries, which is why every one of the bugs below shipped: none of it could
 * be looked at without a browser. It is pure and DOM-free here so
 * `lib/story-playback.test.ts` can pin the decisions directly rather than
 * asserting on the source text of a component.
 */

/** How long a picture holds the viewer. A story is a glance. */
export const STORY_PICTURE_MS = 5000;

/**
 * How long a video story may hold the viewer.
 *
 * A story is still a glance, and an author who uploads a ten-minute clip must
 * not be able to freeze the set on it — but cutting every clip at the picture
 * duration was why sound "did not work": you heard five seconds of a
 * thirty-second video and the viewer moved on.
 */
export const STORY_VIDEO_MAX_MS = 60_000;

/**
 * How far past its own length a clip may run before the viewer stops waiting.
 *
 * The progress bar follows the CLIP's clock, not the wall clock, so a stalled
 * download holds the bar with the picture instead of racing ahead of it — which
 * is right, and is also how a dead connection could park the reader on one
 * frame forever. The wall clock keeps running underneath purely as this
 * backstop: a clip that has had its whole length plus this grace and still has
 * not finished is not buffering, it is broken.
 */
export const STORY_STALL_GRACE_MS = 8000;

/**
 * Why a story is being held.
 *
 * Held as independent REASONS rather than one `paused` boolean because they
 * overlap constantly — a reader can press and hold while the cursor is also
 * inside the frame — and a single boolean means whichever release fires first
 * resumes a story the other reason still wants held.
 */
export interface StoryHold {
  /** A finger or button is down on the frame. */
  pressing: boolean;
  /** A mouse is resting over the frame, having actually moved there. */
  hovering: boolean;
  /** The tab is in the background. */
  hidden: boolean;
}

export function isHeld(hold: StoryHold): boolean {
  return hold.pressing || hold.hovering || hold.hidden;
}

/**
 * A clip's length in milliseconds, from `HTMLMediaElement.duration`.
 *
 * Returns null for a length that cannot time anything: a live or fragmented
 * stream reports `Infinity`, an unreadable file reports `NaN`, and timing a
 * story off either stalls the set forever. Null means "keep the picture beat".
 */
export function clipDurationMs(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds * 1000, STORY_VIDEO_MAX_MS);
}

/** How long the current story holds the viewer, measured or not. */
export function storyDurationMs(measuredMs: number | null | undefined): number {
  return measuredMs ?? STORY_PICTURE_MS;
}

/**
 * The progress bar's next value — and it only ever moves FORWARD.
 *
 * Two things make a naive `elapsed / duration` jump. The bar used to store
 * elapsed time as a FRACTION of the duration, so the moment a clip's real
 * length replaced the picture beat the same fraction meant a different number
 * of milliseconds and the bar leapt (0.2 of 5s became 0.2 of 30s — six seconds
 * of a clip that had played one). And when the clip's own clock takes over from
 * the wall clock at `loadedmetadata`, `currentTime` is a little behind the wall
 * time already spent, which would drag the bar backwards. Clamping to the
 * previous value absorbs both: a segment that has advanced never un-advances.
 */
export function advanceRatio(previous: number, elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 1;
  return Math.min(1, Math.max(previous, elapsedMs / durationMs));
}

/** A clip has stopped being slow and started being broken. */
export function hasOverrun(wallMs: number, durationMs: number): boolean {
  return wallMs >= durationMs + STORY_STALL_GRACE_MS;
}

/** Where the viewer is: which author, and which of their stories. */
export interface StoryPosition {
  group: number;
  story: number;
}

/**
 * The next story: on through the author's own set, then into the next author,
 * then nothing — the Instagram traversal. `null` means "the set is finished",
 * which the viewer answers by closing.
 *
 * Empty groups are stepped over rather than landed on: a group with no stories
 * has no story to show, and stopping on one would strand the viewer on a blank
 * frame that no timer can advance past.
 */
export function nextPosition(at: StoryPosition, sizes: readonly number[]): StoryPosition | null {
  const size = sizes[at.group] ?? 0;
  if (at.story + 1 < size) return { group: at.group, story: at.story + 1 };
  for (let group = at.group + 1; group < sizes.length; group++) {
    if ((sizes[group] ?? 0) > 0) return { group, story: 0 };
  }
  return null;
}

/**
 * The previous story. CLAMPS at the very first one rather than closing.
 *
 * Tapping back on the first story used to close the whole viewer, which reads
 * as the app deciding you are done because you asked to see something again.
 * Returning the same position is the caller's signal to replay the current
 * story, which is what Instagram does.
 */
export function previousPosition(at: StoryPosition, sizes: readonly number[]): StoryPosition {
  if (at.story > 0) return { group: at.group, story: at.story - 1 };
  for (let group = at.group - 1; group >= 0; group--) {
    const size = sizes[group] ?? 0;
    if (size > 0) return { group, story: size - 1 };
  }
  return at;
}

/**
 * Whether a rejected `play()` is the autoplay policy refusing SOUND — the one
 * rejection the viewer should answer by dropping to muted.
 *
 * This is the whole difference between a working fallback and a viewer that
 * goes silent for the rest of the session. `play()` also rejects with
 * `AbortError` whenever a pause or a new `src` overtakes it, which happens
 * every single time the reader taps through stories quickly — and treating
 * that as "the browser refused sound" turned sound off for every story that
 * followed. `NotSupportedError` (a clip that will not decode) is not a sound
 * problem either.
 *
 * Duck-typed rather than `instanceof DOMException` so it can be tested without
 * a DOM, and so a rejection from another realm still classifies.
 */
export function isAutoplayRefusal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "NotAllowedError"
  );
}

/** The part of a media element this module needs. Structural, so tests need no DOM. */
export interface PausableMedia {
  paused: boolean;
}

/**
 * Everything on the page the viewer has to silence when it opens.
 *
 * The story viewer is a fixed overlay, and an `IntersectionObserver` measures
 * the VIEWPORT, not what is on top of it — so a feed clip 60% on screen went on
 * playing, with sound, underneath an opened story that was also playing with
 * sound. Two things talking at once.
 *
 * Only elements that are actually PLAYING are collected, and they are returned
 * rather than just paused, because the list is also the undo: on close the
 * viewer restarts exactly what it stopped and nothing else. Pausing everything
 * indiscriminately and resuming everything on the way out would start clips the
 * reader had deliberately left alone.
 */
export function mediaToSilence<T extends PausableMedia>(
  all: Iterable<T>,
  isOurs: (media: T) => boolean
): T[] {
  const stopped: T[] = [];
  for (const media of all) {
    if (isOurs(media) || media.paused) continue;
    stopped.push(media);
  }
  return stopped;
}
