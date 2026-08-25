"use client";

import { useEffect, useRef, useState } from "react";
import type { RemoteTrack, Room } from "livekit-client";
import { Spinner } from "@/components/ui/button";
import { IconVolume } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { registerRoom, unregisterRoom } from "@/features/streams/lib/live-room";

type ViewerState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "waiting"
  | "failed"
  /**
   * The server evicted us because another connection joined with our identity.
   * Reconnecting would just evict that one back, so this state is terminal by
   * design and says what actually happened.
   */
  | "duplicate";

// Subscriber-side LiveKit playback: connects with the playback token and
// attaches whatever the host publishes. The SDK owns reconnection; this
// component only narrates it. Imported lazily so HLS-only sessions never load
// the SDK.
export function LiveKitPlayer({
  streamId,
  url,
  token,
  onPlayingChange,
  fill = false,
}: {
  /** Claims this stream's single Room slot — see lib/live-room.ts. */
  streamId: string;
  url: string;
  token: string;
  onPlayingChange?: (playing: boolean) => void;
  /** Full-bleed mode: fills the parent instead of a rounded 16:9 box. */
  fill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<ViewerState>("connecting");
  const [videoCount, setVideoCount] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const playingRef = useRef(onPlayingChange);
  useEffect(() => {
    playingRef.current = onPlayingChange;
  }, [onPlayingChange]);

  useEffect(() => {
    let room: Room | null = null;
    let cancelled = false;
    const container = containerRef.current;

    const setPlaying = (playing: boolean) => playingRef.current?.(playing);

    void import("livekit-client").then(async ({ Room, RoomEvent, Track, DisconnectReason }) => {
      if (cancelled) return;
      const instance = new Room({ adaptiveStream: true });
      room = instance;
      roomRef.current = instance;
      // Claim the slot BEFORE connecting: if something else already holds it,
      // we must not put a second participant on this identity.
      try {
        registerRoom(streamId, instance);
      } catch {
        setState("duplicate");
        room = null;
        roomRef.current = null;
        return;
      }

      const attach = (track: RemoteTrack) => {
        // `track.attach()` with no argument mints a *new* element every call
        // and appends it to the track's own attachedElements list. LiveKit
        // re-emits TrackSubscribed for already-subscribed tracks after a
        // reconnect or a server-side migration, so attaching blind leaves two
        // <audio> elements decoding the same stream a few ms apart — which is
        // audible as doubling/flanging, not as a clean duplicate. Detaching
        // first guarantees exactly one element per track.
        track.detach().forEach((stale) => stale.remove());
        const element = track.attach();
        element.autoplay = true;
        if (track.kind === Track.Kind.Video) {
          element.className = "h-full min-h-0 w-full min-w-0 object-cover";
          (element as HTMLVideoElement).playsInline = true;
          containerRef.current?.appendChild(element);
          setVideoCount(containerRef.current?.querySelectorAll("video").length ?? 1);
          setState("live");
          setPlaying(true);
        } else {
          // Audio elements stay out of layout, but must never be muted or
          // attenuated — the mute affordance belongs to the page, not here.
          element.style.display = "none";
          element.muted = false;
          element.volume = 1;
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
          setVideoCount(containerRef.current?.querySelectorAll("video").length ?? 0);
          refreshState();
        })
        // Browsers block unmuted autoplay until the tab has been interacted
        // with. LiveKit reports that optimistically and only tells us after
        // the fact, so surface a real unmute control instead of leaving the
        // viewer watching a silent stream.
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setAudioBlocked(!instance.canPlaybackAudio);
        })
        .on(RoomEvent.TrackMuted, refreshState)
        .on(RoomEvent.TrackUnmuted, refreshState)
        .on(RoomEvent.Reconnecting, () => {
          setState("reconnecting");
          setPlaying(false);
        })
        .on(RoomEvent.Reconnected, refreshState)
        // DisconnectReason.DUPLICATE_IDENTITY means someone connected as us.
        // The SDK does not retry this, and neither should we — an automatic
        // reconnect here is precisely the loop that killed the mobile
        // renderer. Name it instead.
        .on(RoomEvent.Disconnected, (reason) => {
          setPlaying(false);
          setState(reason === DisconnectReason.DUPLICATE_IDENTITY ? "duplicate" : "failed");
        })
        .on(RoomEvent.ParticipantDisconnected, refreshState);

      try {
        await instance.connect(url, token);
        if (cancelled) {
          void instance.disconnect();
          return;
        }
        refreshState();
        setAudioBlocked(!instance.canPlaybackAudio);
      } catch {
        if (!cancelled) setState("failed");
      }
    });

    return () => {
      cancelled = true;
      setPlaying(false);
      // Drop every media element we minted before tearing the room down, so a
      // remount cannot inherit an orphaned element still holding a decoder.
      container?.querySelectorAll("video, audio").forEach((element) => element.remove());
      roomRef.current = null;
      if (room) unregisterRoom(streamId, room);
      void room?.disconnect();
    };
  }, [streamId, url, token]);

  // Must run inside a real click handler — that is what lifts the autoplay
  // block for the rest of the session.
  const startAudio = () => {
    void roomRef.current
      ?.startAudio()
      .then(() => setAudioBlocked(false))
      .catch(() => {});
  };

  return (
    <div
      className={
        fill
          ? "relative h-full w-full overflow-hidden bg-black"
          : "relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
      }
    >
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 grid gap-0.5 bg-black",
          videoCount <= 1 ? "grid-cols-1" : "grid-cols-2",
          videoCount >= 3 && "grid-rows-2"
        )}
      />
      {audioBlocked && (
        <button
          onClick={startAudio}
          className="ws-glass absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-heading"
        >
          <IconVolume className="h-4 w-4" />
          Tap for sound
        </button>
      )}
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
          {state === "duplicate" && (
            <>
              <p className="text-sm text-down">This stream is open somewhere else.</p>
              <p className="max-w-xs text-xs text-grey-500">
                You can only watch from one tab or device at a time. Close the other
                one and refresh.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
