"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { ensureUploadLimits, getUploadLimits } from "@/lib/api/upload";
import {
  pickRecordingType,
  recordingFileName,
} from "@/features/messages/lib/voice-recorder";
import { getRoomSession } from "@/lib/room-session-store";
import { pushLevel, rmsLevel } from "@/lib/voice-levels";

/**
 * Recording a voice note.
 *
 * The microphone button was inert because there was no recorder — the send
 * endpoint accepts audio now, so this is the half that was missing.
 *
 * ─── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
 * It decides whether a usable format exists BEFORE opening the microphone. A
 * browser that can only encode something the service rejects has to say so up
 * front; discovering it after somebody has spoken for thirty seconds means
 * throwing their message away, and that is the one failure a recorder must not
 * have.
 *
 * The permission prompt is therefore the SECOND thing that happens, not the
 * first — there is no point asking for a microphone we could not use.
 *
 * ─── THE TRACKS ARE ALWAYS STOPPED ───────────────────────────────────────────
 * Every exit path releases the stream, including cancel and error. A live
 * `getUserMedia` track leaves the browser's recording indicator on, which
 * reads to the user as an app still listening after they thought they had
 * stopped — the worst possible bug in this particular feature.
 */
export interface VoiceRecording {
  file: File;
  /** Measured while recording, so it never has to be demuxed afterwards. */
  durationSeconds: number;
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /*
    WHAT THE MICROPHONE IS ACTUALLY HEARING.

    A pulsing dot and a clock both animate happily while the microphone is
    muted, covered, or pointed at nothing — so the one question a person has
    while recording ("is this getting me?") had no answer until playback. These
    are measured levels, newest last. See lib/voice-levels.ts.
  */
  const [levels, setLevels] = useState<number[]>([]);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  // The metering half, torn down by `release` with everything else.
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  // Set when the user cancels, so `onstop` knows to discard rather than
  // resolve — the recorder fires `stop` identically either way.
  const discarded = useRef(false);

  const release = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    // The meter goes first: it reads the analyser, and the analyser is about
    // to be torn down with the context.
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
    analyser.current = null;
    // An AudioContext left open holds the audio hardware awake, which is the
    // same class of bug as a live track — see the note on tracks above.
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recorder.current = null;
    chunks.current = [];
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio.");
      return false;
    }
    // The service's own allowlist, fetched — never a compiled-in guess about
    // what it takes.
    await ensureUploadLimits();
    const mimeType = pickRecordingType(
      (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
      getUploadLimits().audioContentTypes
    );
    if (!mimeType) {
      setError("This browser can't record a format we can send.");
      return false;
    }

    // ONE LIVE MICROPHONE. A gist room keeps playing behind a DM, and an open
    // mic there would carry this voice note to the whole room while it is
    // recorded (and on iOS a second capture can kill the room's track). The
    // room's mic is muted first — never reopened for them afterwards.
    const room = getRoomSession();
    if (room.micOn) {
      await room.toggleMic();
      toast("Your gist room mic is muted while you record.");
    }

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied, dismissed, or no device — all the same to the reader, and all
      // fixed in the same place.
      setError("Microphone access was blocked.");
      return false;
    }

    discarded.current = false;
    chunks.current = [];
    const media = new MediaRecorder(stream.current, { mimeType });
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    recorder.current = media;
    startedAt.current = Date.now();
    media.start();
    setElapsed(0);
    // Empty, not a row of silent bars: the waveform starts when the recording
    // does, so the first bar arriving IS the confirmation that the microphone
    // opened. A pre-filled row looks identical before and after that moment.
    setLevels([]);
    setRecording(true);
    ticker.current = setInterval(
      () => setElapsed((Date.now() - startedAt.current) / 1000),
      250
    );

    /*
      THE METER. Best-effort, and deliberately so: if the Web Audio API is
      missing or the context refuses to open, the note still records and sends
      — the waveform is feedback, not the feature. A recorder that refused to
      record because it could not draw would be the wrong trade.

      80ms is ~12 frames a second. Fast enough that a syllable moves the row,
      slow enough that it is not re-rendering a component on every frame.
    */
    try {
      const Ctor = window.AudioContext ?? (window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;
      if (Ctor && stream.current) {
        const ctx = new Ctor();
        audioCtx.current = ctx;
        const node = ctx.createAnalyser();
        // Small window: this is a loudness meter, not a spectrogram.
        node.fftSize = 256;
        ctx.createMediaStreamSource(stream.current).connect(node);
        analyser.current = node;
        const samples = new Uint8Array(node.fftSize);
        meter.current = setInterval(() => {
          const live = analyser.current;
          if (!live) return;
          live.getByteTimeDomainData(samples);
          const level = rmsLevel(samples);
          setLevels((previous) => pushLevel(previous, level));
        }, 80);
      }
    } catch {
      // No meter, still a recorder. See above.
    }
    return true;
  }, []);

  /** Stops and returns the recording, or null when there was nothing usable. */
  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    const media = recorder.current;
    if (!media) return null;
    const mimeType = media.mimeType;
    const seconds = (Date.now() - startedAt.current) / 1000;

    const blob = await new Promise<Blob | null>((resolve) => {
      media.onstop = () => resolve(discarded.current ? null : new Blob(chunks.current, { type: mimeType }));
      media.stop();
    });
    release();
    setRecording(false);
    setElapsed(0);
    if (!blob || blob.size === 0) return null;
    return {
      file: new File([blob], recordingFileName(mimeType), { type: mimeType }),
      durationSeconds: seconds,
    };
  }, [release]);

  const cancel = useCallback(() => {
    discarded.current = true;
    // `stop()` fires `onstop`, which resolves null because of the flag above;
    // the tracks are released there. Calling `release()` directly here would
    // tear the recorder down before it emitted its final chunk.
    if (recorder.current && recorder.current.state !== "inactive") {
      recorder.current.stop();
    } else {
      release();
    }
    setRecording(false);
    setElapsed(0);
  }, [release]);

  return {
    recording,
    elapsed,
    levels,
    error,
    start,
    stop,
    cancel,
    clearError: () => setError(null),
  };
}
