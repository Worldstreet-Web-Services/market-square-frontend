"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
}

// Green-room device check: a real getUserMedia preview with device pickers
// and a live mic meter, so nobody goes live blind. Independent of LiveKit —
// the chosen deviceIds are handed to the publisher at go-live.
export function useDeviceCheck(
  videoRef: React.RefObject<HTMLVideoElement | null>
): DeviceCheck {
  const [status, setStatus] = useState<DeviceCheck["status"]>("idle");
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [mics, setMics] = useState<MediaDeviceOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const [wanted, setWanted] = useState(false);

  const request = useCallback(() => setWanted(true), []);

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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraId ? { deviceId: { exact: cameraId } } : true,
          audio: micId ? { deviceId: { exact: micId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }

        // Device labels only populate after permission is granted.
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCameras(
            devices
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
  }, [wanted, cameraId, micId, videoRef]);

  return {
    status,
    cameras,
    mics,
    cameraId,
    micId,
    setCameraId,
    setMicId,
    micLevel,
    request,
  };
}
