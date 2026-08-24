"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioCaptureOptions, LocalAudioTrack, LocalTrack, Room } from "livekit-client";
import { setBroadcastLive } from "@/hooks/use-broadcast-status";
import type { Ingest } from "@/features/streams/lib/types";

// Speech capture profile for a talking host. These are stated explicitly
// rather than left to the browser for three reasons:
//   * `createLocalTracks()` is a standalone helper — unlike
//     `room.localParticipant.setMicrophoneEnabled()`, it does NOT merge the
//     SDK's `audioDefaults`, so `audio: true` publishes with whatever raw
//     constraint set the UA picks. Toggling the mic off and on then produced a
//     *differently processed* track than the one we went live with.
//   * A guest speaker publishes from inside the stream room, where the host's
//     audio is coming out of the same laptop's speakers. Without an explicit
//     `echoCancellation`, that loop is re-broadcast to everyone as echo.
//   * `channelCount: 1` is load-bearing: LiveKit disables Opus RED *and* DTX
//     for tracks it detects as stereo (LocalParticipant.publishTrack →
//     `if (isStereo) { opts.dtx ??= false; opts.red ??= false }`). RED is the
//     redundant-encoding that hides packet loss, so a mic reporting two
//     channels silently costs us our packet-loss protection.
const SPEECH_CAPTURE: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
  channelCount: 1,
};

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
  /** 0..1 smoothed level of the track we are actually publishing. */
  micLevel: number;
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
  const [micLevel, setMicLevel] = useState(0);

  const url = ingest?.url ?? "";
  const token = ingest?.roomToken ?? "";

  const active = Boolean(enabled && url && token);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let room: Room | null = null;
    let tracks: LocalTrack[] = [];

    let meter: { stop: () => void } | null = null;

    void import("livekit-client").then(
      async ({
        Room,
        RoomEvent,
        Track,
        ConnectionQuality: CQ,
        AudioPresets,
        createLocalTracks,
        createAudioAnalyser,
      }) => {
        if (cancelled) return;
        setState("connecting");
        setQuality("unknown");
        const audioCapture: AudioCaptureOptions = preferredMic
          ? { ...SPEECH_CAPTURE, deviceId: preferredMic }
          : SPEECH_CAPTURE;
        const instance = new Room({
          // Mirrors the initial capture so a mic toggle (which re-creates the
          // track through the SDK) republishes with the same processing and
          // the same device instead of falling back to the system default.
          audioCaptureDefaults: audioCapture,
          publishDefaults: {
            // 48 kbps mono Opus. Stated rather than inherited, and *not*
            // dropped to AudioPresets.speech (24 kbps): the reported symptom
            // is quality, not bandwidth, and RED already doubles the effective
            // audio rate — ~96 kbps total is still ~5% of the 1.7 Mbps the
            // 720p video track budgets, so there is nothing to buy by
            // squeezing speech further.
            audioPreset: AudioPresets.music,
            // Explicit because the SDK only defaults these on for tracks it
            // considers mono; pinning them means a mic that misreports its
            // channel count cannot quietly turn off loss concealment.
            red: true,
            dtx: true,
            forceStereo: false,
          },
        });
        room = instance;
        roomRef.current = instance;

        const stopMeter = () => {
          meter?.stop();
          meter = null;
          setMicLevel(0);
        };
        const startMeter = (track: LocalAudioTrack) => {
          stopMeter();
          const analyser = createAudioAnalyser(track);
          const timer = setInterval(() => {
            // calculateVolume() returns a 0..1 RMS; speech sits low in that
            // range, so scale it the same way the green-room meter does.
            setMicLevel(Math.min(1, analyser.calculateVolume() * 3));
          }, 100);
          meter = {
            stop: () => {
              clearInterval(timer);
              void analyser.cleanup().catch(() => {});
            },
          };
        };

        instance
          .on(RoomEvent.LocalTrackPublished, (publication) => {
            if (publication.kind === Track.Kind.Audio && publication.track) {
              startMeter(publication.track as LocalAudioTrack);
            }
          })
          .on(RoomEvent.LocalTrackUnpublished, (publication) => {
            if (publication.kind === Track.Kind.Audio) stopMeter();
          })
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
            audio: audioCapture,
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
      meter?.stop();
      setMicLevel(0);
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
  return {
    state: effectiveState,
    quality,
    micOn,
    camOn,
    micLevel: micOn ? micLevel : 0,
    toggleMic,
    toggleCam,
    switchCamera,
    switchMic,
  };
}
