"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

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
  const [muted, setMuted] = useState(true);
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
          video.pause();
          // Leaving the viewport also drops sound, so scrolling back never
          // surprises the reader with audio they did not ask for again.
          setMuted(true);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        controls={reduced}
        className="h-full w-full object-cover"
      />
      {!reduced && (
        <button
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? "Unmute video" : "Mute video"}
          aria-pressed={!muted}
          className="absolute inset-0 flex items-end justify-start p-3"
        >
          <span className="ws-glass rounded-full px-2.5 py-1 text-[10px] font-semibold text-body">
            {muted ? "Tap for sound" : "Sound on"}
          </span>
        </button>
      )}
    </div>
  );
}
