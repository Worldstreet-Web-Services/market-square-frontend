/**
 * Whether feed video plays with sound, for the whole session.
 *
 * Held outside React, in ONE place, because the choice belongs to the reader
 * and not to a video. Each `InlineVideo` used to own a `muted` boolean, so
 * turning sound on for one clip and scrolling to the next put you back in
 * silence — every video asked the same question again, and the answer never
 * carried.
 *
 * DELIBERATELY not persisted. A fresh page load must start muted whatever was
 * chosen last time: browsers refuse unmuted autoplay until the reader has
 * interacted with the page, so restoring "sound on" from storage would produce
 * a video that silently refuses to play rather than one that plays silently.
 * Within a session the choice sticks, which is the part that was broken.
 *
 * Pure and dependency-free so it can be tested without a DOM.
 */

let soundOn = false;
/**
 * Has the reader made an explicit choice this session?
 *
 * Opening a video full-screen turns sound ON, because tapping a video to fill
 * the screen is a request to watch it, not to mime it — that is what every
 * short-video app does and what the story viewer here already does. But it
 * must NOT override somebody who has deliberately muted: a reader who taps
 * mute and keeps swiping wants quiet, and re-unmuting them on the next post
 * would be the same disrespect as forgetting they asked for sound.
 */
let chosen = false;
const listeners = new Set<() => void>();

export function isFeedSoundOn(): boolean {
  return soundOn;
}

/** The server has no session, and autoplay starts muted. */
export function getFeedSoundServerSnapshot(): boolean {
  return false;
}

export function setFeedSoundOn(next: boolean): void {
  // An explicit tap is a decision, even when it lands on the value already
  // held — it stops the viewer from turning sound back on afterwards.
  chosen = true;
  if (soundOn === next) return;
  soundOn = next;
  for (const listener of listeners) listener();
}

/**
 * Turn sound on because a video was opened full-screen — unless the reader
 * has already said otherwise this session.
 */
export function preferSoundForImmersive(): void {
  if (chosen || soundOn) return;
  soundOn = true;
  for (const listener of listeners) listener();
}

export function subscribeFeedSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: no user action can reach this, and nothing in the app calls it. */
export function resetFeedSoundForTest(): void {
  soundOn = false;
  chosen = false;
  listeners.clear();
}
