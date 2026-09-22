"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { captureErrorMessage, classifyCaptureError } from "@/lib/media-errors";
import { getRoom, subscribeRoom } from "@/features/streams/lib/live-room";
import { stageSources } from "@/features/streams/lib/capture-plan";
import { STAGE_STALL_MS, type StageState } from "@/lib/stage-recovery";

export { STAGE_FAILURES, type StageState } from "@/lib/stage-recovery";

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
 *
 * What it will NOT do is claim the guest is on stage because a row somewhere
 * says `approved`. `state` describes this connection and nothing else.
 *
 * `StageState` and `STAGE_FAILURES` live in `lib/stage-recovery.ts` alongside
 * the rule that turns them into a panel — the union and the decision that
 * reads it drift apart the moment they live in different files, and that
 * drift is exactly what let "approved" mean "on stage". Re-exported above so
 * callers still have one import.
 */

export interface StageControls {
  state: StageState;
  micOn: boolean;
  camOn: boolean;
  /** Mic came up but the camera did not — a success worth naming. */
  audioOnly: boolean;
  error: string | null;
  /** Re-acquire the local devices. The remedy for a camera that was busy. */
  retry: () => void;
  /**
   * Throw away the playback token and come back on a new connection.
   *
   * The remedy for a MISSING GRANT, which `retry` cannot touch: the devices
   * are fine, this LiveKit connection simply is not the one the host's
   * approval landed on — or is one whose grant died with a reconnect, or with
   * the ≤5 min token it was issued under. The backend mints an approved
   * speaker's playback token WITH publish rights, so refetching it is the
   * whole repair: the player reconnects on the new token and the grant is
   * there before the first frame.
   */
  rejoin: () => void;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
}

/**
 * Publish once, retrying a single time on a permission refusal.
 *
 * `setMicrophoneEnabled`/`setCameraEnabled` are already idempotent — enabling a
 * source that is on resolves without republishing — so this is safe to re-enter.
 * The one retry covers the signal blip when LiveKit Cloud reissues our token on
 * `updateParticipant`: the grant is real, but the publish can land inside the
 * reconnect window and be refused once.
 */
const GRANT_RETRY_MS = 1200;

async function enableOnce(enable: () => Promise<unknown>): Promise<void> {
  try {
    await enable();
  } catch (error) {
    if (!isPermissionRefusal(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, GRANT_RETRY_MS));
    await enable();
  }
}

/** LiveKit refuses a publish without permission; that is a grant problem, not a device one. */
function isPermissionRefusal(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("permission") || message.includes("not allowed to publish");
}

export function useStage({
  streamId,
  approved,
  withCamera = true,
  previewRef,
}: {
  streamId: string;
  approved: boolean;
  /**
   * Whether going on stage includes a camera. FALSE in a house, permanently.
   *
   * The decision is made once, by `stageSources()` in
   * features/streams/lib/capture-plan.ts, so what a house may turn on is a
   * pure function that can be asserted without a browser rather than an inline
   * ternary that reads the same either way. `audioOnly` stays false, deliberately:
   * in a house, audio-only is the product and a guest must never be told their
   * camera was unavailable.
   */
  withCamera?: boolean;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}): StageControls {
  const sources = stageSources({ withCamera });
  const cameraAllowed = sources.includes("camera");
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
  /**
   * The attempt whose connect/grant wait outlived STAGE_STALL_MS.
   *
   * Held as the attempt number rather than a boolean so `stalled` can be
   * DERIVED. A boolean needs clearing whenever the wait ends or a retry
   * starts, and clearing it means a synchronous setState inside the effect
   * that watches those things — cascading renders, and one more piece of state
   * that can disagree with reality.
   */
  const [stalledAttempt, setStalledAttempt] = useState<number | null>(null);
  // Publishing is a one-shot per approval; without this the effect re-runs on
  // every room notification and re-acquires the devices.
  const startedFor = useRef<string | null>(null);

  /**
   * Whether the SERVER says we may publish, read fresh off the participant.
   *
   * Never derived from `approved`. `approved` is the backend's speaker-request
   * row — it says the host clicked Accept, not that this LiveKit connection has
   * the grant. Publishing on the row is the documented anti-pattern: the SDK
   * refuses the publish, the guest sees their own camera (a local track needs
   * no permission), and nobody else ever receives them. That is precisely the
   * reported symptom.
   */
  const [granted, setGranted] = useState(false);
  // Derived, not stored: with no room there is no grant to speak of.
  const canPublish = room ? granted : false;
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    let off: (() => void) | undefined;
    void import("livekit-client").then(({ RoomEvent }) => {
      if (cancelled) return;
      // Re-read `permissions` off the participant on every notification rather
      // than trusting the event payload or anything cached at join — LiveKit
      // documents races where the cached role trails the grant.
      const sync = () => setGranted(room.localParticipant.permissions?.canPublish === true);
      room.on(RoomEvent.ParticipantPermissionsChanged, sync);
      room.on(RoomEvent.Connected, sync);
      room.on(RoomEvent.Reconnected, sync);
      off = () => {
        room.off(RoomEvent.ParticipantPermissionsChanged, sync);
        room.off(RoomEvent.Connected, sync);
        room.off(RoomEvent.Reconnected, sync);
      };
      sync();
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [room]);

  useEffect(() => {
    if (!approved) {
      startedFor.current = null;
      return;
    }
    if (!room) return;
    // The gate. LiveKit Cloud reissues the token on `updateParticipant`, so the
    // grant can land a beat after the host's approve call returns.
    if (!canPublish) return;
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
        await enableOnce(() => room.localParticipant.setMicrophoneEnabled(true));
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

      if (cameraAllowed) {
        try {
          await enableOnce(() => room.localParticipant.setCameraEnabled(true));
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
      }
      if (!cancelled) setPhase("live");
    })();

    return () => {
      cancelled = true;
    };
  }, [approved, room, streamId, attempt, canPublish, cameraAllowed]);

  // Mirror the local camera into the caller's preview box. Never entered on
  // the audio-only path: there is no camera track and no preview box.
  useEffect(() => {
    if (!room || !camOn || !previewRef) return;
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
      // Detach only THIS element — the same local track is also attached to our
      // tile on the stage, and a bare detach() would blank that too.
      track.detach(element);
      element.remove();
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
      if (cameraAllowed) {
        await room.localParticipant.setCameraEnabled(false).catch(() => {});
      }
      if (cancelled) return;
      setMicOn(false);
      setCamOn(false);
      setAudioOnly(false);
      setPhase("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [approved, room, cameraAllowed]);

  const toggleMic = useCallback(async () => {
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [room, micOn]);

  const toggleCam = useCallback(async () => {
    if (!room) return;
    if (!cameraAllowed) {
      console.warn("useStage: this stage is audio only — there is no camera to toggle.");
      return;
    }
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
  }, [room, camOn, cameraAllowed]);

  const retry = useCallback(() => {
    setError(null);
    setAudioOnly(false);
    setAttempt((n) => n + 1);
  }, []);

  /**
   * Reconnect on a fresh token.
   *
   * Invalidating the playback query is the whole mechanism: `usePlaybackToken`
   * refetches, `LiveKitPlayer` keys its connect effect on the token, so the
   * room comes down and back up — and the new token carries the publish grant
   * for an approved speaker, which the old one may never have had. Everything
   * downstream (the grant listener, the publish effect) then runs normally
   * against the new room.
   *
   * The local flags are reset first so the panel does not spend the reconnect
   * still showing the failure that prompted it.
   */
  const queryClient = useQueryClient();
  const rejoin = useCallback(() => {
    setError(null);
    setAudioOnly(false);
    setMicOn(false);
    setCamOn(false);
    setPhase("idle");
    startedFor.current = null;
    setAttempt((n) => n + 1);
    void queryClient.invalidateQueries({ queryKey: ["ms", "stream", streamId, "playback"] });
  }, [queryClient, streamId]);

  /**
   * "Connecting" that never connects is a failure, and must be named as one.
   *
   * `waiting-for-room` and `awaiting-grant` are both legitimate for a second
   * or two and both can last forever: the room may never come up, and the
   * grant may have been applied to a connection that no longer exists. Neither
   * resolves itself, and while they spun the panel showed a pulsing dot and
   * offered nothing but "Leave stage" — the reported dead end. After
   * STAGE_STALL_MS we stop pretending and hand over a remedy.
   */
  const pending = approved && !canPublish && phase !== "live";
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setStalledAttempt(attempt), STAGE_STALL_MS);
    return () => clearTimeout(timer);
    // `attempt` restarts the clock after a retry or a rejoin: a second attempt
    // gets the same patience as the first, not zero.
  }, [pending, attempt]);
  // Both ways out clear themselves: the grant landing ends `pending`, and a
  // retry or rejoin moves `attempt` past the one that stalled.
  const stalled = pending && stalledAttempt === attempt;

  const state: StageState = !approved
    ? "idle"
    : !room
      ? stalled
        ? "grant-stalled"
        : "waiting-for-room"
      : !canPublish && phase !== "live"
        ? stalled
          ? "grant-stalled"
          : "awaiting-grant"
        : phase;

  return {
    state,
    micOn,
    // Both pinned on the audio-only path, for the same reason they are pinned
    // in usePublisher: nothing here can publish video, so reporting either from
    // state would describe a possibility that does not exist.
    camOn: cameraAllowed ? camOn : false,
    audioOnly: cameraAllowed ? audioOnly : false,
    error,
    retry,
    rejoin,
    toggleMic,
    toggleCam,
  };
}
