"use client";

import { useEffect, useRef, useState } from "react";
import { useActiveVideo } from "@/hooks/use-active-video";
import { VIDEO_LAYER } from "@/lib/video-coordinator";
import { cn } from "@/lib/cn";
import { IconVolume } from "@/components/ui/icons";
import { MediaFrame } from "@/components/ui/media-frame";

/**
 * A clip in the timeline.
 *
 * Reels grammar: exactly ONE video plays anywhere in the app, and it is the
 * one the reader is looking at. This component no longer decides that for
 * itself — it reports how much of itself is on screen and does what the
 * coordinator says. It used to observe its own intersection and call `play()`
 * whenever it was 60% visible, which on a tall window is true of two cards at
 * once; that is how two clips ended up sounding together.
 *
 * Sound is a session choice (`feed-sound`) and applies to the ACTIVE video
 * only. Both halves are needed: without the session store the answer never
 * carried to the next clip, and without the active check every mounted clip
 * honoured it simultaneously.
 *
 * Under `prefers-reduced-motion` nothing plays on its own: the element keeps
 * its native controls, stays out of the election entirely, and is never paused
 * out from under a reader who pressed play.
 */
export function InlineVideo({
  src,
  poster,
  className,
  fit = false,
  onFirstPlay,
}: {
  src: string;
  poster?: string | null;
  className?: string;
  /**
   * Fired ONCE, when the clip genuinely starts playing (`playing`, not
   * `play`: the element has frames and is advancing). The card uses it to
   * report the view — a video's count is plays, not dwell.
   */
  onFirstPlay?: () => void;
  /**
   * Let the CLIP set the box, instead of the box cropping the clip.
   *
   * The timeline draws media at its own width, left-aligned, up to the column
   * (496:13599 against 496:13662) — so on a card there is no leftover space
   * beside the picture and nothing for an ambient layer to fill. The video goes
   * into flow with a max height and an automatic width, and `MediaFrame` is
   * skipped entirely rather than painting a blurred backdrop behind a frame
   * that fits.
   *
   * Off everywhere else: a full-viewport slide DOES have leftover space, and
   * there the letterbox fill is the whole point.
   */
  fit?: boolean;
}) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const { ref, muted, toggleSound } = useActiveVideo({
    layer: VIDEO_LAYER.feed,
    enabled: !reduced,
  });
  const played = useRef(false);
  const handlePlaying = () => {
    if (played.current) return;
    played.current = true;
    onFirstPlay?.();
  };

  const sound = (
    <button
        onClick={(event) => {
        // The frame around it may open the video. Sound is not that.
        event.stopPropagation();
        // Answers for the session, and claims this clip as the one playing
        // — otherwise tapping a card that is on screen but not elected
        // turns sound on somewhere else entirely.
        toggleSound();
        }}
        aria-label={muted ? "Unmute video" : "Mute video"}
        aria-pressed={!muted}
        className="ws-glass ws-press absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold text-body transition-colors hover:text-white"
      >
        <IconVolume className="h-3.5 w-3.5" muted={muted} />
        {muted ? "Tap for sound" : "Sound on"}
      </button>
  );

  const video = (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted={muted}
      loop
      playsInline
      preload="metadata"
      controls={reduced}
      onPlaying={handlePlaying}
      className={
        fit
          ? "block h-auto max-h-[420px] w-auto max-w-full rounded-xl object-contain"
          : "absolute inset-0 h-full w-full object-contain"
      }
    />
  );

  if (fit) {
    return (
      // `w-fit` so the sound pill anchors to the CLIP's corner rather than to a
      // full-width box it no longer fills.
      <div className={cn("relative w-fit", className)}>
        {video}
        {!reduced && sound}
      </div>
    );
  }

  return (
    // Contained, never cropped: a landscape clip in a fixed-height card lost
    // its sides to `object-cover`. MediaFrame fills the letterbox with the
    // clip's own poster rather than a black bar — and when the ratios already
    // match, the ambient layer is never seen.
    <MediaFrame backdrop={poster} className={cn("relative", className)}>
      {video}
      {/* The sound control is the PILL, not the whole surface.
          It used to be `absolute inset-0`, which made every pixel of the video
          a mute toggle. Once the card wrapped the player in a tap-to-expand
          button that had to be neutralised with `pointer-events-none`, and the
          sound control went with it: the pill still said "Tap for sound" and
          did nothing, while the tap expanded the video instead.

          A control the size of its own label leaves the rest of the frame free
          for whatever the surface wants a tap to mean. */}
      {!reduced && sound}
    </MediaFrame>
  );
}
