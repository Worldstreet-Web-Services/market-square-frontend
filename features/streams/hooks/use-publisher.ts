"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalTrack, Room } from "livekit-client";
import { setBroadcastLive } from "@/hooks/use-broadcast-status";
import type { Ingest } from "@/features/streams/lib/types";

export type PublisherState =
  | "idle"
  | "connecting"
  | "publishing"
  | "reconnecting"
  | "denied"
  | "failed";

export type ConnectionQuality = "excellent" | "good" | "poor" | "unknown";

export interface PublisherControls {
  state: PublisherState;
  quality: ConnectionQuality;
  micOn: boolean;
  camOn: boolean;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMic: (deviceId: string) => Promise<void>;
}

// Everything the browser-publish path needs, shared by the cockpit layouts:
// LiveKit connect + camera/mic publish, local preview, toggles, device
// switching, connection quality, the shell's live indicator, and the two
// leave-guards (beforeunload + in-app link confirm). The SDK owns reconnects.
export function usePublisher({
  ingest,
  enabled,
  streamId,
  preferredCamera,
  preferredMic,
  previewRef,
}: {
  ingest: Ingest | null;
  enabled: boolean;
  streamId: string;
  preferredCamera?: string;
  preferredMic?: string;
  /** Caller-owned mount point for the mirrored local preview element. */
  previewRef: React.RefObject<HTMLDivElement | null>;
}): PublisherControls {
  const roomRef = useRef<Room | null>(null);
  const [state, setState] = useState<PublisherState>("idle");
  const [quality, setQuality] = useState<ConnectionQuality>("unknown");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const url = ingest?.url ?? "";
  const token = ingest?.roomToken ?? "";

  const active = Boolean(enabled && url && token);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let room: Room | null = null;
    let tracks: LocalTrack[] = [];

    void import("livekit-client").then(
      async ({ Room, RoomEvent, Track, ConnectionQuality: CQ, createLocalTracks }) => {
        if (cancelled) return;
        setState("connecting");
        setQuality("unknown");
        const instance = new Room();
        room = instance;
        roomRef.current = instance;

        instance
          .on(RoomEvent.Reconnecting, () => setState("reconnecting"))
          .on(RoomEvent.Reconnected, () => setState("publishing"))
          .on(RoomEvent.Disconnected, () => setState("failed"))
          .on(RoomEvent.ConnectionQualityChanged, (q, participant) => {
            if (participant !== instance.localParticipant) return;
            setQuality(
              q === CQ.Excellent
                ? "excellent"
                : q === CQ.Good
                  ? "good"
                  : q === CQ.Poor
                    ? "poor"
                    : "unknown"
            );
          });

        try {
          tracks = await createLocalTracks({
            audio: preferredMic ? { deviceId: preferredMic } : true,
            video: preferredCamera ? { deviceId: preferredCamera } : true,
          });
        } catch {
          if (!cancelled) setState("denied");
          return;
        }
        if (cancelled) {
          tracks.forEach((track) => track.stop());
          return;
        }

        try {
          await instance.connect(url, token);
          for (const track of tracks) {
            await instance.localParticipant.publishTrack(track);
            if (track.kind === Track.Kind.Video) {
              const element = track.attach();
              element.className = "h-full w-full object-cover [transform:scaleX(-1)]";
              previewRef.current?.replaceChildren(element);
            }
          }
          if (!cancelled) {
            setState("publishing");
            setBroadcastLive(streamId);
          }
        } catch {
          if (!cancelled) setState("failed");
        }
      }
    );

    return () => {
      cancelled = true;
      tracks.forEach((track) => track.stop());
      void room?.disconnect();
      roomRef.current = null;
      setBroadcastLive(null);
    };
  }, [active, url, token, streamId, preferredCamera, preferredMic, previewRef]);

  // Leave-guards while on air: tab close/reload asks first; in-app link
  // clicks (except new-tab links) require an explicit confirm.
  useEffect(() => {
    if (state !== "publishing") return;
    const message = "You're live — leaving stops your broadcast.";
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    const onClickCapture = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (anchor.getAttribute("target") === "_blank" || !href.startsWith("/")) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [state]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
  }, [camOn]);

  const switchCamera = useCallback(async (deviceId: string) => {
    await roomRef.current?.switchActiveDevice("videoinput", deviceId);
  }, []);

  const switchMic = useCallback(async (deviceId: string) => {
    await roomRef.current?.switchActiveDevice("audioinput", deviceId);
  }, []);

  // Outside an active session the publisher is idle by definition.
  const effectiveState = active ? state : "idle";
  return { state: effectiveState, quality, micOn, camOn, toggleMic, toggleCam, switchCamera, switchMic };
}
