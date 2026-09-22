/**
 * What a publisher is allowed to capture, decided BEFORE any device is touched.
 *
 * Houses are audio only, permanently — for the host as much as for a guest, and
 * not as a degraded fallback. "No camera" enforced by convention is a rule that
 * survives exactly until the next person adds a toggle because it seemed
 * harmless; so the decision is lifted out of the two publish hooks into two
 * pure functions that can be asserted without a browser, and the hooks are
 * written so a camera path is unreachable rather than merely unused.
 *
 * `capturePlan` is the literal argument handed to `createLocalTracks`. When
 * `audioOnly` is true the returned object has NO `video` key at all — not
 * `video: false`, which is a value somebody can flip, but an absent key, which
 * is the shape `createLocalTracks` cannot acquire a camera from.
 *
 * `stageSources` is the same decision for the upgrade path, where the guest is
 * already connected and sources are enabled one at a time.
 *
 * Pure, no value imports, so `node --test` can load it. Pinned by
 * lib/house-audio-only.test.ts.
 */

/**
 * Whatever audio constraints the caller already built.
 *
 * Deliberately a type PARAMETER rather than `Record<string, unknown>`: the two
 * callers pass LiveKit's `AudioCaptureOptions` and the DOM's
 * `MediaTrackConstraints`, neither of which has an index signature, and this
 * module has no business knowing either shape. It decides one thing — whether
 * a camera may be asked for — and hands the audio straight back.
 */
export interface CapturePlan<A> {
  audio: A;
  /**
   * Present ONLY on the camera path. Absent — not false — when audio only, so
   * there is no key for a future edit to set.
   */
  video?: true | { deviceId: string };
}

export function capturePlan<A>({
  audio,
  audioOnly,
  preferredCamera,
}: {
  audio: A;
  audioOnly?: boolean;
  preferredCamera?: string;
}): CapturePlan<A> {
  if (audioOnly) return { audio };
  return { audio, video: preferredCamera ? { deviceId: preferredCamera } : true };
}

/** True when this plan could acquire a camera. The guard the fallback path reads. */
export function planHasVideo<A>(plan: CapturePlan<A>): boolean {
  return "video" in plan;
}

export type StageSource = "microphone" | "camera";

/**
 * Which sources an approved speaker turns on over the connection they have.
 *
 * The list is the loop `useStage` runs, so `withCamera: false` does not skip a
 * branch — it produces a shorter list, and `setCameraEnabled` is never named on
 * that path.
 *
 * Note what is NOT here: `screen_share`. Screen share is video by another name
 * and there is no flag that adds it.
 */
export function stageSources({ withCamera }: { withCamera: boolean }): readonly StageSource[] {
  return withCamera ? ["microphone", "camera"] : ["microphone"];
}

/**
 * The device check's constraints.
 *
 * Same shape and the same reason: audio-only asks for `{ audio }` with no
 * `video` key, so the browser never shows a camera prompt on a screen that has
 * no camera on it. A permission dialog naming a device the product does not use
 * is the single loudest way to contradict "no camera, ever".
 */
export interface PreviewConstraints<A> {
  audio: A;
  video?: true | { deviceId: { exact: string } };
}

export function previewConstraints<A>({
  audio,
  audioOnly,
  cameraId,
}: {
  audio: A;
  audioOnly?: boolean;
  cameraId?: string;
}): PreviewConstraints<A> {
  if (audioOnly) return { audio };
  return { audio, video: cameraId ? { deviceId: { exact: cameraId } } : true };
}
