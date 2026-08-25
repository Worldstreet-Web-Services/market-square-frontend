"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioCaptureOptions, LocalAudioTrack, LocalTrack, Room } from "livekit-client";
import { setBroadcastLive } from "@/hooks/use-broadcast-status";
// The taxonomy is pure and lives in lib/ so it can be pinned by tests —
// lib/media-errors.test.ts owns the name → class table.
import { captureErrorMessage as errorMessage, classifyCaptureError } from "@/lib/media-errors";
import type { Ingest } from "@/features/streams/lib/types";
import { registerRoom, unregisterRoom } from "@/features/streams/lib/live-room";

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

/**
 * A WebRTC connect that has not settled in this long is not going to. Without
 * it the guest panel sat on "Connecting you to the stage…" forever, with no
 * failure and no way out.
 */
const CONNECT_TIMEOUT_MS = 15_000;

/**
 * Capture failures are NOT all "permission denied".
 *
 * Every throw used to collapse into `denied`, so the panel told a guest whose
 * camera was simply held by another tab to "allow camera access" — a prompt
 * that will never appear, because permission was already granted. The browser
 * distinguishes these cases by `err.name`; each one needs its own remedy.
 */
export type PublisherState =
  | "idle"
  | "connecting"
  | "publishing"
  | "reconnecting"
  /** NotAllowedError / SecurityError — permission actually refused. */
  | "denied"
  /** NotReadableError / TrackStartError — device held by another app or tab. */
  | "device-busy"
  /** NotFoundError / OverconstrainedError — nothing matches the constraints. */
  | "device-missing"
  /** Connect did not settle inside CONNECT_TIMEOUT_MS. */
  | "timeout"
  | "failed";

/** The subset of states that end the attempt and offer a retry. */
export const PUBLISHER_FAILURES: readonly PublisherState[] = [
  "denied",
  "device-busy",
  "device-missing",
  "timeout",
  "failed",
];

export type ConnectionQuality = "excellent" | "good" | "poor" | "unknown";

export interface PublisherControls {
  state: PublisherState;
  quality: ConnectionQuality;
  micOn: boolean;
  camOn: boolean;
  /**
   * True when the camera could not be acquired but the mic could, so we joined
   * with audio alone rather than failing the whole join. `toggleCam` can still
   * bring video up later if the device frees.
   */
  audioOnly: boolean;
  /** The underlying message for `failed`; null for the classified states. */
  error: string | null;
  /** 0..1 smoothed level of the track we are actually publishing. */
  micLevel: number;
  /** Tears down and starts the connect again from scratch. */
  retry: () => void;
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
  const [audioOnly, setAudioOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumping this re-runs the connect effect from scratch — the Retry control.
  const [attempt, setAttempt] = useState(0);

  const url = ingest?.url ?? "";
  const token = ingest?.roomToken ?? "";

  const active = Boolean(enabled && url && token);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let room: Room | null = null;
    let tracks: LocalTrack[] = [];
    let settled = false;

    let meter: { stop: () => void } | null = null;

    // The spin-forever guard. Cleared the moment the attempt settles either
    // way; if it fires first, the panel gets a real failure and a Retry.
    const timer = setTimeout(() => {
      if (cancelled || settled) return;
      settled = true;
      setState("timeout");
      void room?.disconnect();
    }, CONNECT_TIMEOUT_MS);
    const settle = (next: PublisherState, message: string | null = null) => {
      if (cancelled || settled) return;
      settled = true;
      clearTimeout(timer);
      setError(message);
      setState(next);
    };

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
        // The host cockpit is the only other thing that opens a Room. Claiming
        // the slot means a page that somehow renders both the cockpit and the
        // viewer for one stream fails loudly here instead of silently putting
        // two participants on one identity — the eviction loop this registry
        // exists to prevent.
        try {
          registerRoom(streamId, instance);
        } catch (duplicate) {
          settle("failed", errorMessage(duplicate));
          room = null;
          roomRef.current = null;
          return;
        }

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
          // A drop after we were live is a real failure; a drop during the
          // connect is already covered by the timeout/catch below.
          .on(RoomEvent.Disconnected, () => {
            if (settled) setState("failed");
          })
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

        let joinedAudioOnly = false;
        try {
          tracks = await createLocalTracks({
            audio: audioCapture,
            video: preferredCamera ? { deviceId: preferredCamera } : true,
          });
        } catch (cameraError) {
          // The camera failed — but a guest usually cares about being HEARD.
          // Before failing the whole join, try audio alone. This is the exact
          // shape of the reported bug: two browser profiles on one laptop, the
          // host holding the camera, the guest perfectly able to speak.
          const cameraFailure = classifyCaptureError(cameraError);
          try {
            tracks = await createLocalTracks({ audio: audioCapture });
            joinedAudioOnly = true;
          } catch (audioError) {
            // Both failed. Report on whichever error is more specific: if the
            // mic failed for the same reason, that reason covers the device
            // generally; otherwise the camera's classification is the story.
            const audioFailure = classifyCaptureError(audioError);
            settle(
              audioFailure === "failed" ? cameraFailure : audioFailure,
              audioFailure === "failed" && cameraFailure === "failed"
                ? errorMessage(cameraError)
                : null
            );
            return;
          }
        }
        if (cancelled) {
          tracks.forEach((track) => track.stop());
          return;
        }
        if (joinedAudioOnly) {
          setAudioOnly(true);
          setCamOn(false);
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
            settle("publishing");
            setBroadcastLive(streamId);
          }
        } catch (connectError) {
          // LiveKit's ConnectionError used to be swallowed into the same silent
          // state as everything else; surface its message instead.
          settle("failed", errorMessage(connectError));
        }
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
      meter?.stop();
      setMicLevel(0);
      tracks.forEach((track) => track.stop());
      if (room) unregisterRoom(streamId, room);
      void room?.disconnect();
      roomRef.current = null;
      setBroadcastLive(null);
    };
  }, [active, url, token, streamId, preferredCamera, preferredMic, previewRef, attempt]);

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

  // Also the recovery path out of audio-only: `setCameraEnabled(true)` acquires
  // the device on demand, so once the other tab releases it, this brings video
  // up without rejoining. It can still fail (device busy again), so the throw
  // is classified rather than left to reject an unhandled promise.
  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !camOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCamOn(next);
      if (next) {
        setAudioOnly(false);
        setError(null);
      }
    } catch (cameraError) {
      const failure = classifyCaptureError(cameraError);
      setCamOn(false);
      setAudioOnly(true);
      setError(
        failure === "device-busy"
          ? "Your camera is still in use by another app or browser tab."
          : failure === "device-missing"
            ? "No camera found."
            : failure === "denied"
              ? "Camera access is blocked in your browser settings."
              : errorMessage(cameraError)
      );
    }
  }, [camOn]);

  const retry = useCallback(() => {
    setError(null);
    setAudioOnly(false);
    setCamOn(true);
    setMicOn(true);
    setState("idle");
    setAttempt((n) => n + 1);
  }, []);

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
    audioOnly: active && audioOnly,
    error: active ? error : null,
    micLevel: micOn ? micLevel : 0,
    retry,
    toggleMic,
    toggleCam,
    switchCamera,
    switchMic,
  };
}
