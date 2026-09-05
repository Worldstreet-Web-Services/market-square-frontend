"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewConstraints } from "@/features/streams/lib/capture-plan";

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface DeviceCheck {
  status: "idle" | "requesting" | "ready" | "denied" | "unavailable";
  cameras: MediaDeviceOption[];
  mics: MediaDeviceOption[];
  cameraId: string;
  micId: string;
  setCameraId: (id: string) => void;
  setMicId: (id: string) => void;
  /** 0..1 smoothed mic input level, driven by a WebAudio analyser. */
  micLevel: number;
  request: () => void;
  /** Hand the devices back before the publisher opens its own capture. */
  release: () => void;
}

// Kept identical to the publisher's SPEECH_CAPTURE constants on purpose: the
// meter is only a preview of the published track if it is measuring the same
// processing chain. Noise suppression and AGC change the RMS materially, so a
// raw `audio: true` preview reads a level the viewer never hears.
const PREVIEW_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

// Green-room device check: a real getUserMedia preview with device pickers
// and a live mic meter, so nobody goes live blind. Independent of LiveKit —
// the chosen deviceIds are handed to the publisher at go-live.
export function useDeviceCheck(
  videoRef: React.RefObject<HTMLVideoElement | null> | null,
  /**
   * Houses. With `audioOnly` set, `getUserMedia` is called with no `video` key
   * at all, `cameras` stays empty, and no `videoRef` is required.
   *
   * The reason this is not just "ignore the video track we get": a
   * `getUserMedia({ video: true })` shows the browser's own camera permission
   * prompt, and a prompt naming a device on a screen that says "no camera,
   * ever" contradicts the product's one promise louder than any copy can
   * repair.
   */
  options: { audioOnly?: boolean } = {}
): DeviceCheck {
  const audioOnly = options.audioOnly === true;
  const [status, setStatus] = useState<DeviceCheck["status"]>("idle");
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  // What the browser actually gave us, which is not necessarily what was
  // asked for. Before this, both ids stayed "" until the user touched a
  // dropdown, so the publisher received `undefined` and re-resolved "default"
  // itself — the meter could be reading a headset while the broadcast went
  // out on the laptop's built-in mic.
  const [resolvedCameraId, setResolvedCameraId] = useState("");
  const [resolvedMicId, setResolvedMicId] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const [wanted, setWanted] = useState(false);

  const request = useCallback(() => setWanted(true), []);
  // Flipping `wanted` runs the effect's cleanup, which stops the tracks and
  // closes the AudioContext. Two live captures of the same microphone let the
  // second one inherit constraints negotiated for the first, so the green room
  // must let go before the publisher opens its own.
  const release = useCallback(() => setWanted(false), []);

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;

    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (audioRef.current) {
        cancelAnimationFrame(audioRef.current.raf);
        void audioRef.current.ctx.close().catch(() => {});
        audioRef.current = null;
      }
    };

    const start = async () => {
      stop();
      setStatus("requesting");
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          previewConstraints({
            audio: micId ? { ...PREVIEW_AUDIO, deviceId: { exact: micId } } : PREVIEW_AUDIO,
            audioOnly,
            cameraId,
          })
        );
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setResolvedCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? "");
        setResolvedMicId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? "");
        if (videoRef?.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }

        // Device labels only populate after permission is granted.
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          // An audio-only check never enumerates cameras. Offering a picker for
          // a device this session cannot use is the same contradiction as
          // prompting for it.
          setCameras(
            audioOnly
              ? []
              : devices
                  .filter((d) => d.kind === "videoinput")
                  .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
          );
          setMics(
            devices
              .filter((d) => d.kind === "audioinput")
              .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }))
          );
        }

        // Mic meter: RMS of an analyser frame, smoothed.
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        let smoothed = 0;
        const tick = () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (const value of buffer) {
            const centered = (value - 128) / 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / buffer.length);
          smoothed = smoothed * 0.8 + Math.min(1, rms * 3) * 0.2;
          setMicLevel(smoothed);
          if (audioRef.current) audioRef.current.raf = requestAnimationFrame(tick);
        };
        audioRef.current = { ctx, raf: requestAnimationFrame(tick) };
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("denied");
      }
    };

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [wanted, cameraId, micId, videoRef, audioOnly]);

  return {
    status,
    cameras,
    mics,
    // Report the device in use, not the (possibly empty) request.
    cameraId: resolvedCameraId || cameraId,
    micId: resolvedMicId || micId,
    setCameraId,
    setMicId,
    micLevel,
    request,
    release,
  };
}
