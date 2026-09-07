"use client";

import { useCallback, useRef, useState } from "react";
import { ensureUploadLimits, getUploadLimits } from "@/lib/api/upload";
import {
  pickRecordingType,
  recordingFileName,
} from "@/features/messages/lib/voice-recorder";

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

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  // Set when the user cancels, so `onstop` knows to discard rather than
  // resolve — the recorder fires `stop` identically either way.
  const discarded = useRef(false);

  const release = useCallback(() => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
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
    setRecording(true);
    ticker.current = setInterval(
      () => setElapsed((Date.now() - startedAt.current) / 1000),
      250
    );
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

  return { recording, elapsed, error, start, stop, cancel, clearError: () => setError(null) };
}
