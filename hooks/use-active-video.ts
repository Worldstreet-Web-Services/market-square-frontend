"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import {
  getFeedSoundServerSnapshot,
  isFeedSoundOn,
  setFeedSoundOn,
  subscribeFeedSound,
} from "@/lib/feed-sound";
import {
  getActiveVideoId,
  getActiveVideoServerSnapshot,
  registerVideo,
  reportVideoVisibility,
  requestActiveVideo,
  subscribeActiveVideo,
  VISIBILITY_STEPS,
  type VideoLayer,
} from "@/lib/video-coordinator";

/**
 * Wire one `<video>` into the app-wide "only one plays" rule.
 *
 * This is the only place that calls `play()` on a feed video. Players used to
 * own an IntersectionObserver each and start themselves on their own evidence,
 * which is how two of them ended up playing at once — see `video-coordinator`
 * for why "am I on screen?" is not enough to answer "am I the one?".
 *
 * The element is measured here and elected there. Everything else follows from
 * the elected id: the active video plays and carries the session's sound; every
 * other video is paused AND muted, in that order of certainty.
 *
 * @param layer  Which surface this player is on. See VIDEO_LAYER.
 * @param enabled  False under `prefers-reduced-motion`: that reader drives the
 *   native controls themselves, so this hook neither registers the video nor
 *   touches playback. Pausing a clip somebody pressed play on would be worse
 *   than two of them running.
 */
export function useActiveVideo({ layer, enabled }: { layer: VideoLayer; enabled: boolean }) {
  const id = useId();
  const ref = useRef<HTMLVideoElement>(null);

  const activeId = useSyncExternalStore(
    subscribeActiveVideo,
    getActiveVideoId,
    getActiveVideoServerSnapshot
  );
  const soundOn = useSyncExternalStore(
    subscribeFeedSound,
    isFeedSoundOn,
    getFeedSoundServerSnapshot
  );

  const isActive = enabled && activeId === id;
  // Sound belongs to the SESSION, but audibility belongs to the active video.
  // Both halves matter: without the session store the answer never carried to
  // the next clip, and without the active check every mounted clip honoured it
  // at once, which is the two-soundtracks half of the same report.
  const muted = !(isActive && soundOn);

  // Measure. One observer per player still, but it only reports — the decision
  // is made in one place with every player's numbers in front of it.
  useEffect(() => {
    const video = ref.current;
    if (!video || !enabled) return;

    const unregister = registerVideo(id, layer);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) reportVideoVisibility(id, entry.intersectionRatio);
      },
      { threshold: [...VISIBILITY_STEPS] }
    );
    observer.observe(video);

    return () => {
      observer.disconnect();
      // Leaving re-elects, so a slide unmounting mid-play hands over rather
      // than leaving the feed silent behind a dead id.
      unregister();
    };
  }, [id, layer, enabled]);

  // Obey. The element is told what it is, every time the answer changes.
  useEffect(() => {
    const video = ref.current;
    if (!video || !enabled) return;

    if (!isActive) {
      // Muted BEFORE paused, deliberately. `pause()` takes effect immediately
      // but the element may already be mid-frame with audio; setting muted
      // first means the losing video cannot be heard even for that frame.
      video.muted = true;
      video.pause();
      return;
    }

    video.muted = muted;
    let cancelled = false;
    void video.play().catch(() => {
      // Either we lost a race with an unmount — nothing to report — or the
      // browser refused. If it refused while we were asking for sound, the
      // refusal IS about the sound: autoplay policy blocks audible playback
      // until the reader has interacted with the page.
      if (cancelled || video.muted) return;
      video.muted = true;
      // Drop the session's sound so the control stops claiming "Sound on" over
      // a video the browser will not play. A UI that insists on a state the
      // browser has refused is the thing that makes this feel broken.
      setFeedSoundOn(false);
      void video.play().catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [isActive, muted, enabled]);

  /**
   * The reader's answer to "do I want sound?".
   *
   * It sets the session choice AND claims the crown, because those are one
   * gesture. Tapping sound on a clip that is on screen but not elected has to
   * make THAT clip the one you hear; turning sound on somewhere else is
   * indistinguishable from the bug.
   */
  const toggleSound = useCallback(() => {
    requestActiveVideo(id);
    setFeedSoundOn(muted);
  }, [id, muted]);

  return { ref, isActive, muted, soundOn, toggleSound };
}
