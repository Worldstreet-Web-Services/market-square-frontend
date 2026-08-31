"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getFeedSoundServerSnapshot,
  isFeedSoundOn,
  setFeedSoundOn,
  subscribeFeedSound,
} from "@/lib/feed-sound";
import { cn } from "@/lib/cn";
import { IconVolume } from "@/components/ui/icons";
import { MediaFrame } from "@/components/ui/media-frame";

/**
 * A clip in the timeline.
 *
 * Reels grammar: the video plays muted the moment enough of it is on screen
 * and pauses again when it leaves, so scrolling never leaves half a dozen
 * clips running. Sound is only ever unmuted by an explicit tap — autoplay
 * with audio is both hostile and blocked by every browser.
 *
 * Under `prefers-reduced-motion` nothing plays on its own: the element keeps
 * its native controls and waits to be started.
 */
export function InlineVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  /**
   * Sound is a SESSION choice, not this video's private state.
   *
   * It used to be `useState(true)` here, so turning sound on for one clip and
   * scrolling to the next put the reader back in silence — every video asked
   * the same question and no answer ever carried. One store, every video.
   */
  const soundOn = useSyncExternalStore(
    subscribeFeedSound,
    isFeedSoundOn,
    getFeedSoundServerSnapshot
  );
  const muted = !soundOn;
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video || reduced) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // A play() that loses a race with an unmount rejects; that is not
          // an error worth surfacing.
          void video.play().catch(() => {});
        } else {
          /*
            Pause only. Scrolling a clip out of view used to force sound back
            OFF, which is why turning it on never survived the scroll to the
            next post — the reader answered, and leaving the video revoked the
            answer. A paused video is silent on its own, so nothing leaks; the
            choice now belongs to the session and the next clip honours it.
          */
          video.pause();
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    // Contained, never cropped: a landscape clip in a fixed-height card lost
    // its sides to `object-cover`. MediaFrame fills the letterbox with the
    // clip's own poster rather than a black bar — and when the ratios already
    // match, the ambient layer is never seen.
    <MediaFrame backdrop={poster} className={cn("relative", className)}>
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        controls={reduced}
        className="absolute inset-0 h-full w-full object-contain"
      />
      {/* The sound control is the PILL, not the whole surface.
          It used to be `absolute inset-0`, which made every pixel of the video
          a mute toggle. Once the card wrapped the player in a tap-to-expand
          button that had to be neutralised with `pointer-events-none`, and the
          sound control went with it: the pill still said "Tap for sound" and
          did nothing, while the tap expanded the video instead.

          A control the size of its own label leaves the rest of the frame free
          for whatever the surface wants a tap to mean. */}
      {!reduced && (
        <button
          onClick={(event) => {
            // The frame around it may open the video. Sound is not that.
            event.stopPropagation();
            // Answers for every video in the session, not just this one.
            setFeedSoundOn(muted);
          }}
          aria-label={muted ? "Unmute video" : "Mute video"}
          aria-pressed={!muted}
          className="ws-glass ws-press absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold text-body transition-colors hover:text-white"
        >
          <IconVolume className="h-3.5 w-3.5" muted={muted} />
          {muted ? "Tap for sound" : "Sound on"}
        </button>
      )}
    </MediaFrame>
  );
}
