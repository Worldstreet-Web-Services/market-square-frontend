"use client";

import { useEffect, useRef, useState } from "react";
import type { RemoteTrack, Room } from "livekit-client";
import { Spinner } from "@/components/ui/button";

type ViewerState = "connecting" | "live" | "reconnecting" | "waiting" | "failed";

// Subscriber-side LiveKit playback: connects with the playback token and
// attaches whatever the host publishes. The SDK owns reconnection; this
// component only narrates it. Imported lazily so HLS-only sessions never load
// the SDK.
export function LiveKitPlayer({
  url,
  token,
  onPlayingChange,
  fill = false,
}: {
  url: string;
  token: string;
  onPlayingChange?: (playing: boolean) => void;
  /** Full-bleed mode: fills the parent instead of a rounded 16:9 box. */
  fill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ViewerState>("connecting");
  const playingRef = useRef(onPlayingChange);
  useEffect(() => {
    playingRef.current = onPlayingChange;
  }, [onPlayingChange]);

  useEffect(() => {
    let room: Room | null = null;
    let cancelled = false;

    const setPlaying = (playing: boolean) => playingRef.current?.(playing);

    void import("livekit-client").then(async ({ Room, RoomEvent, Track }) => {
      if (cancelled) return;
      const instance = new Room({ adaptiveStream: true });
      room = instance;

      const attach = (track: RemoteTrack) => {
        const element = track.attach();
        if (track.kind === Track.Kind.Video) {
          element.className = "h-full w-full object-contain";
          containerRef.current?.replaceChildren(element);
          setState("live");
          setPlaying(true);
        } else {
          // Audio elements stay out of layout.
          element.style.display = "none";
          containerRef.current?.appendChild(element);
        }
      };

      const refreshState = () => {
        const hasVideo = Array.from(instance.remoteParticipants.values()).some((participant) =>
          Array.from(participant.videoTrackPublications.values()).some(
            (publication) => publication.isSubscribed && !publication.isMuted
          )
        );
        setState(hasVideo ? "live" : "waiting");
        setPlaying(hasVideo);
      };

      instance
        .on(RoomEvent.TrackSubscribed, (track) => attach(track))
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((element) => element.remove());
          refreshState();
        })
        .on(RoomEvent.TrackMuted, refreshState)
        .on(RoomEvent.TrackUnmuted, refreshState)
        .on(RoomEvent.Reconnecting, () => {
          setState("reconnecting");
          setPlaying(false);
        })
        .on(RoomEvent.Reconnected, refreshState)
        .on(RoomEvent.Disconnected, () => {
          setState("failed");
          setPlaying(false);
        })
        .on(RoomEvent.ParticipantDisconnected, refreshState);

      try {
        await instance.connect(url, token);
        if (cancelled) {
          void instance.disconnect();
          return;
        }
        refreshState();
      } catch {
        if (!cancelled) setState("failed");
      }
    });

    return () => {
      cancelled = true;
      setPlaying(false);
      void room?.disconnect();
    };
  }, [url, token]);

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden bg-black"
          : "relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
      }
    >
      <div ref={containerRef} className="absolute inset-0" />
      {state !== "live" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center">
          {state === "connecting" && <Spinner className="h-8 w-8 text-grey-500" />}
          {state === "reconnecting" && (
            <>
              <Spinner className="h-6 w-6 text-grey-500" />
              <p className="text-xs text-grey-400">Reconnecting…</p>
            </>
          )}
          {state === "waiting" && (
            <p className="text-sm text-grey-400">The host&apos;s camera is off — hang tight.</p>
          )}
          {state === "failed" && (
            <>
              <p className="text-sm text-down">Couldn&apos;t connect to the stream.</p>
              <p className="text-xs text-grey-500">Refresh to try again.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
