"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { captureErrorMessage, classifyCaptureError } from "@/lib/media-errors";
import { getRoom, subscribeRoom } from "@/features/streams/lib/live-room";

/**
 * Going on stage over the connection the guest ALREADY has.
 *
 * An approved guest is a viewer who has been granted publish permission
 * server-side. They do not need a new token or a new Room — and must not open
 * one: the speaker token carries the same LiveKit identity as their playback
 * token, so a second connection evicts the first, the first reconnects and
 * evicts the second, and the loop kills the renderer on mobile.
 *
 * So this hook never connects. It finds the room the player is already on and
 * turns the devices on over it. `setMicrophoneEnabled`/`setCameraEnabled`
 * acquire the hardware and publish in one step; the server-side grant is what
 * makes publishing legal, and if it has not landed the SDK's publish is
 * refused and we report that rather than retrying blindly.
 */
export type StageState =
  | "idle"
  /** Approved, but the viewer connection is not up yet — nothing to upgrade. */
  | "waiting-for-room"
  | "starting"
  | "live"
  /** NotAllowedError / SecurityError — permission actually refused. */
  | "denied"
  /** NotReadableError / TrackStartError — device held by another app or tab. */
  | "device-busy"
  /** NotFoundError / OverconstrainedError — nothing matches the constraints. */
  | "device-missing"
  /** The server has not granted publish permission (yet). */
  | "not-permitted"
  | "failed";

export const STAGE_FAILURES: readonly StageState[] = [
  "denied",
  "device-busy",
  "device-missing",
  "not-permitted",
  "failed",
];

export interface StageControls {
  state: StageState;
  micOn: boolean;
  camOn: boolean;
  /** Mic came up but the camera did not — a success worth naming. */
  audioOnly: boolean;
  error: string | null;
  retry: () => void;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
}

/** LiveKit refuses a publish without permission; that is a grant problem, not a device one. */
function isPermissionRefusal(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("permission") || message.includes("not allowed to publish");
}

export function useStage({
  streamId,
  approved,
  previewRef,
}: {
  streamId: string;
  approved: boolean;
  previewRef: React.RefObject<HTMLDivElement | null>;
}): StageControls {
  // The player owns the room; this re-renders when it appears or goes away.
  const room = useSyncExternalStore(
    useCallback((listener) => subscribeRoom(streamId, listener), [streamId]),
    useCallback(() => getRoom(streamId), [streamId]),
    () => null
  );

  // Only the ACTIVE flow is stored; "idle" and "waiting-for-room" are facts
  // about `approved` and `room`, so they are derived below rather than pushed
  // into state from an effect.
  const [phase, setPhase] = useState<StageState>("idle");
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Publishing is a one-shot per approval; without this the effect re-runs on
  // every room notification and re-acquires the devices.
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!approved) {
      startedFor.current = null;
      return;
    }
    if (!room) return;
    const key = `${streamId}:${attempt}`;
    if (startedFor.current === key) return;
    startedFor.current = key;

    let cancelled = false;
    setPhase("starting");
    setError(null);

    void (async () => {
      // Mic first and separately: a guest cares most about being heard, and a
      // camera that is busy must not cost them the microphone too.
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        if (cancelled) return;
        setMicOn(true);
      } catch (micError) {
        if (cancelled) return;
        if (isPermissionRefusal(micError)) {
          setPhase("not-permitted");
          setError("The host hasn't finished bringing you on stage yet.");
          return;
        }
        setPhase(classifyCaptureError(micError));
        setError(captureErrorMessage(micError));
        return;
      }

      try {
        await room.localParticipant.setCameraEnabled(true);
        if (cancelled) return;
        setCamOn(true);
        setAudioOnly(false);
      } catch (cameraError) {
        if (cancelled) return;
        const failure = classifyCaptureError(cameraError);
        setCamOn(false);
        setAudioOnly(true);
        setError(
          failure === "device-busy"
            ? "Your camera is in use by another app or browser tab."
            : failure === "device-missing"
              ? "No camera found."
              : failure === "denied"
                ? "Camera access is blocked in your browser settings."
                : captureErrorMessage(cameraError)
        );
      }
      if (!cancelled) setPhase("live");
    })();

    return () => {
      cancelled = true;
    };
  }, [approved, room, streamId, attempt]);

  // Mirror the local camera into the caller's preview box.
  useEffect(() => {
    if (!room || !camOn) return;
    // Read the camera off the publication map rather than by source key: the
    // enum value is an SDK detail, and a missing publication must degrade to
    // "no preview" rather than throwing inside an effect.
    const track = Array.from(room.localParticipant.videoTrackPublications.values()).find(
      (publication) => publication.videoTrack
    )?.videoTrack;
    if (!track) return;
    const element = track.attach();
    element.className = "h-full w-full object-cover [transform:scaleX(-1)]";
    previewRef.current?.replaceChildren(element);
    return () => {
      track.detach().forEach((stale) => stale.remove());
    };
  }, [room, camOn, previewRef, phase]);

  /**
   * Leaving the stage returns to plain viewing.
   *
   * Only the local tracks come down — the Room stays connected, because it is
   * the same connection playback is running on. Disconnecting here would black
   * out the stream the guest is still watching.
   */
  useEffect(() => {
    if (approved || !room) return;
    let cancelled = false;
    void (async () => {
      await room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      await room.localParticipant.setCameraEnabled(false).catch(() => {});
      if (cancelled) return;
      setMicOn(false);
      setCamOn(false);
      setAudioOnly(false);
      setPhase("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [approved, room]);

  const toggleMic = useCallback(async () => {
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [room, micOn]);

  const toggleCam = useCallback(async () => {
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
            : captureErrorMessage(cameraError)
      );
    }
  }, [room, camOn]);

  const retry = useCallback(() => {
    setError(null);
    setAudioOnly(false);
    setAttempt((n) => n + 1);
  }, []);

  const state: StageState = !approved ? "idle" : room ? phase : "waiting-for-room";

  return { state, micOn, camOn, audioOnly, error, retry, toggleMic, toggleCam };
}
