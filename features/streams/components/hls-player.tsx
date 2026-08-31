"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/button";

// HLS playback: native <video> where the browser supports HLS (Safari),
// hls.js everywhere else. hls.js is imported lazily so the room's first paint
// does not pay for it.
/**
 * The rendition ladder, surfaced so the room's control bar can offer a real
 * quality pick instead of a decorative "AUTO" label. `current` is hls.js's
 * `currentLevel`: -1 means adaptive. Native (Safari) HLS owns its own ABR and
 * exposes no ladder, so no api is reported there and the control stays hidden.
 */
export interface QualityApi {
  levels: Array<{ height: number }>;
  current: number;
  setLevel: (index: number) => void;
}

export function HlsPlayer({
  src,
  onPlayingChange,
  onSourceAspect,
  fill = false,
  captionSrc,
  onQuality,
}: {
  src: string;
  onPlayingChange?: (playing: boolean) => void;
  /**
   * The stream's intrinsic shape, so the page can size its frame to the
   * broadcast rather than to an assumption. An Ark game feed is 16:9 and was
   * being dropped into a 9:16 column, which is the same letterbox the LiveKit
   * stage had.
   */
  onSourceAspect?: (aspect: number | null) => void;
  /** Full-bleed mode: fills the parent instead of a rounded 16:9 box. */
  fill?: boolean;
  captionSrc?: string | null;
  onQuality?: (api: QualityApi | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  // The callback identity must not re-run the attach effect (a new hls.js
  // instance per render would tear playback down).
  const qualityRef = useRef(onQuality);
  useEffect(() => {
    qualityRef.current = onQuality;
  }, [onQuality]);
  const aspectRef = useRef(onSourceAspect);
  useEffect(() => {
    aspectRef.current = onSourceAspect;
  }, [onSourceAspect]);

  // Intrinsic size is not known before metadata, and it CHANGES: an HLS ladder
  // can switch to a rendition of a different shape mid-stream, which fires
  // `resize` and not `loadedmetadata`.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const read = () => {
      const { videoWidth, videoHeight } = video;
      aspectRef.current?.(videoWidth > 0 && videoHeight > 0 ? videoWidth / videoHeight : null);
    };
    video.addEventListener("loadedmetadata", read);
    video.addEventListener("resize", read);
    read();
    return () => {
      video.removeEventListener("loadedmetadata", read);
      video.removeEventListener("resize", read);
      aspectRef.current?.(null);
    };
  }, []);

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
        const publish = () =>
          qualityRef.current?.({
            levels: instance.levels.map((level) => ({ height: level.height })),
            current: instance.currentLevel,
            setLevel: (index: number) => {
              instance.currentLevel = index;
              publish();
            },
          });
        instance.on(Hls.Events.MANIFEST_PARSED, publish);
        instance.on(Hls.Events.LEVEL_SWITCHED, publish);
        hls = instance;
      });
    }

    return () => {
      cancelled = true;
      qualityRef.current?.(null);
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
