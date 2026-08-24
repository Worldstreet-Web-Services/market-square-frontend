"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/button";

// HLS playback: native <video> where the browser supports HLS (Safari),
// hls.js everywhere else. hls.js is imported lazily so the room's first paint
// does not pay for it.
export function HlsPlayer({
  src,
  onPlayingChange,
  fill = false,
  captionSrc,
}: {
  src: string;
  onPlayingChange?: (playing: boolean) => void;
  /** Full-bleed mode: fills the parent instead of a rounded 16:9 box. */
  fill?: boolean;
  captionSrc?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    setLoading(true);
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setFailed(true);
          return;
        }
        const instance = new Hls({ enableWorker: true });
        instance.loadSource(src);
        instance.attachMedia(video);
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setFailed(true);
        });
        hls = instance;
      });
    }

    return () => {
      cancelled = true;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden bg-black"
          : "relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
      }
    >
      {loading && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner className="h-8 w-8 text-grey-500" />
        </div>
      )}
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-down">Playback failed in this browser.</p>
          <p className="text-xs text-grey-500">Try refreshing, or a different browser.</p>
        </div>
      ) : (
        <video
          ref={videoRef}
          controls={!fill}
          autoPlay
          playsInline
          className="h-full w-full"
          onPlaying={() => {
            setLoading(false);
            onPlayingChange?.(true);
          }}
          onPause={() => onPlayingChange?.(false)}
          onWaiting={() => setLoading(true)}
          onEnded={() => onPlayingChange?.(false)}
          onError={() => setFailed(true)}
        >
          {captionSrc && <track kind="captions" src={captionSrc} srcLang="en" label="English" default />}
        </video>
      )}
    </div>
  );
}
