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
const listeners = new Set<() => void>();

export function isFeedSoundOn(): boolean {
  return soundOn;
}

/** The server has no session, and autoplay starts muted. */
export function getFeedSoundServerSnapshot(): boolean {
  return false;
}

export function setFeedSoundOn(next: boolean): void {
  if (soundOn === next) return;
  soundOn = next;
  for (const listener of listeners) listener();
}

export function subscribeFeedSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: no user action can reach this, and nothing in the app calls it. */
export function resetFeedSoundForTest(): void {
  soundOn = false;
  listeners.clear();
}
