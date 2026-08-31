/**
 * Which ONE video is allowed to play.
 *
 * The rule the reader already knows from TikTok: whatever is in front of them
 * is playing, and nothing else is. Everything that is not the one video is
 * paused AND silent — not merely quiet, not merely off-screen.
 *
 * We did not have that rule. Every player mounted its own IntersectionObserver
 * at `threshold: 0.6` and called `play()` whenever it was intersecting, with
 * nothing standing between them. Two players satisfy 60% at once more often
 * than that sounds:
 *
 *   - A tall window. A timeline card's clip is 420px; two of them clear 60%
 *     together in anything much past ~700px of viewport, which is most desktop
 *     browsers.
 *   - The full-screen viewer. It is `fixed inset-0` OVER a timeline that stays
 *     mounted. The card underneath is completely hidden and still reports
 *     itself fully visible, because IntersectionObserver measures geometry and
 *     knows nothing about what is painted on top of it.
 *
 * Two players, both intersecting, both calling `play()`. Two soundtracks.
 *
 * Forcing `muted = true` on the way out of view used to hide this: the second
 * video still played, silently. Removing that force-mute — so a reader's
 * choice of sound could survive a scroll — is what made the collision audible.
 * The force-mute was a symptom suppressor, and this module removes the need
 * for it by fixing what it was covering up: only one video ever plays.
 *
 * Pure and DOM-free. `electActiveVideo` is a function of candidates and the
 * incumbent, so the whole rule is testable without a browser.
 */

/**
 * How much of a video must be on screen before it may be elected at all.
 * Matches the threshold the individual observers used, so the point at which
 * a clip starts is unchanged — only the arbitration between clips is new.
 */
export const MIN_VISIBLE_RATIO = 0.6;

/**
 * How far a challenger must beat the sitting video by to take the crown.
 *
 * Hysteresis, and it is load-bearing. Momentum scrolling walks two slides past
 * each other through a band where their visible fractions are within a percent
 * or two, and a bare `>` there hands the crown back and forth every frame.
 * Each handover is a `pause()` and a `play()` on a real media element, which is
 * a stutter and, once sound is on, an audible chirp. The incumbent holds
 * through the noise and only yields to a clear winner.
 */
export const HOLD_MARGIN = 0.05;

/**
 * Surfaces, ordered by which one the reader is actually looking at.
 *
 * This exists because visible ratio CANNOT answer the question on its own. The
 * full-screen viewer covers the timeline exactly; both report themselves fully
 * visible, and the tie would be settled by registration order — which would
 * elect the card the reader can no longer see. Occlusion is not observable
 * from an IntersectionObserver, so the surface that knows it is on top says so.
 */
export const VIDEO_LAYER = {
  /** In the page: timeline cards, the reels column inside a tab. */
  feed: 0,
  /** Over the page: the full-screen video viewer. */
  overlay: 1,
} as const;

export type VideoLayer = (typeof VIDEO_LAYER)[keyof typeof VIDEO_LAYER];

export interface VideoCandidate {
  /** Stable for the lifetime of one mounted player. */
  id: string;
  /** Fraction of the element on screen, 0…1. */
  ratio: number;
  /** See VIDEO_LAYER. */
  layer: number;
  /** Registration order. The last tiebreak, so the result never depends on Map iteration luck. */
  seq: number;
}

/** Strict ordering over candidates: layer, then visibility, then age. */
function outranks(a: VideoCandidate, b: VideoCandidate): boolean {
  if (a.layer !== b.layer) return a.layer > b.layer;
  if (a.ratio !== b.ratio) return a.ratio > b.ratio;
  // Equal on both. The earlier registration wins — first in the document, and
  // deterministic, which is the whole point of carrying `seq`.
  return a.seq < b.seq;
}

/**
 * Elect the one video that may play.
 *
 * `incumbentId` is who is playing now. It is an INPUT, not just bookkeeping:
 * the incumbent keeps the crown through ties and near-ties (see HOLD_MARGIN).
 * An incumbent that has unmounted, or dropped below the threshold, is simply
 * not among the candidates and holds nothing.
 *
 * Returns `null` when nothing is visible enough — the honest answer for a
 * reader scrolled into a stretch of text posts, and the signal that every
 * player should be paused.
 */
export function electActiveVideo(
  candidates: readonly VideoCandidate[],
  incumbentId: string | null
): string | null {
  let best: VideoCandidate | null = null;
  let incumbent: VideoCandidate | null = null;

  for (const candidate of candidates) {
    // Written as `>=` rather than `< … continue` so a NaN ratio — an element
    // measured before layout — fails the test instead of passing it.
    if (!(candidate.ratio >= MIN_VISIBLE_RATIO)) continue;
    if (candidate.id === incumbentId) incumbent = candidate;
    if (best === null || outranks(candidate, best)) best = candidate;
  }

  if (best === null) return null;
  // Nobody is sitting, or the sitter has gone: the ranking decides outright.
  if (incumbent === null) return best.id;
  // A higher surface is not a close call to be smoothed over. The viewer that
  // just opened takes the crown immediately.
  if (best.layer !== incumbent.layer) return best.id;
  return best.ratio > incumbent.ratio + HOLD_MARGIN ? best.id : incumbent.id;
}

/**
 * The thresholds an observer should report at.
 *
 * IntersectionObserver only calls back when a listed threshold is CROSSED, so
 * a single `0.6` reports "past 60%" and never how far past. The election
 * compares ratios against each other, so it needs the shape of the curve, not
 * one point on it. Twenty steps is finer than HOLD_MARGIN and cheap.
 */
export const VISIBILITY_STEPS: readonly number[] = Array.from(
  { length: 41 },
  (_, step) => step / 40
);

/* ------------------------------------------------------------------------ *
 * The registry.
 *
 * Module scope, one per document, in the same shape as `feed-sound`: a plain
 * store with a subscribe seam so `useSyncExternalStore` can read it. No DOM —
 * players report a number and are told an id back.
 * ------------------------------------------------------------------------ */

interface Registration {
  layer: number;
  seq: number;
  ratio: number;
}

const registrations = new Map<string, Registration>();
const listeners = new Set<() => void>();
let nextSeq = 0;
let activeId: string | null = null;

export function getActiveVideoId(): string | null {
  return activeId;
}

/** The server renders no active video: nothing has been measured yet. */
export function getActiveVideoServerSnapshot(): null {
  return null;
}

export function subscribeActiveVideo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function settle(next: string | null): void {
  if (next === activeId) return;
  activeId = next;
  for (const listener of listeners) listener();
}

function reelect(): void {
  const candidates: VideoCandidate[] = [];
  for (const [id, registration] of registrations) candidates.push({ id, ...registration });
  settle(electActiveVideo(candidates, activeId));
}

/**
 * Join the election. Returns the leave function.
 *
 * A player registers at ratio 0 and reports its way up, so mounting never
 * steals the crown from whatever the reader is already watching — the observer
 * decides that a moment later, on evidence.
 */
export function registerVideo(id: string, layer: number): () => void {
  registrations.set(id, { layer, seq: nextSeq++, ratio: 0 });
  reelect();
  return () => {
    if (!registrations.delete(id)) return;
    // Unmounting mid-play is ordinary: a virtualised list drops the slide
    // behind you. Re-electing here is what stops the feed going silent.
    reelect();
  };
}

export function reportVideoVisibility(id: string, ratio: number): void {
  const registration = registrations.get(id);
  if (!registration || registration.ratio === ratio) return;
  registration.ratio = ratio;
  reelect();
}

/**
 * Ask for the crown, on the reader's behalf.
 *
 * Tapping the sound control on a clip that is on screen but not the elected
 * one has to make THAT clip the one you hear — otherwise the tap turns sound
 * on somewhere else, which the reader cannot tell apart from the bug being
 * reported.
 *
 * A deliberate tap OUTRANKS the ranking, hysteresis included: the reader
 * pointing at a video is better evidence of what they are watching than any
 * number of visible pixels, and "the video I tapped stayed silent because a
 * neighbour was showing more of itself" is not a defensible answer.
 *
 * The one thing it cannot override is the visibility floor. A video that is
 * barely on screen still may not play, so a stray tap on something scrolling
 * away does not start audio the reader cannot see the source of.
 */
export function requestActiveVideo(id: string): void {
  const registration = registrations.get(id);
  if (!registration || !(registration.ratio >= MIN_VISIBLE_RATIO)) return;
  settle(id);
}

/** Test seam. Nothing in the app calls it. */
export function resetVideoCoordinatorForTest(): void {
  registrations.clear();
  listeners.clear();
  nextSeq = 0;
  activeId = null;
}
