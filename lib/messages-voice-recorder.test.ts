import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  baseType,
  formatElapsed,
  pickRecordingType,
  recordingFileName,
} from "../features/messages/lib/voice-recorder.ts";

const SERVICE_AUDIO = ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"];

describe("pickRecordingType", () => {
  it("prefers Opus in WebM where the browser supports it", () => {
    assert.equal(pickRecordingType(() => true, SERVICE_AUDIO), "audio/webm;codecs=opus");
  });

  it("falls back to audio/mp4 on Safari, which has neither WebM nor Opus", () => {
    const safari = (type: string) => type === "audio/mp4";
    assert.equal(pickRecordingType(safari, SERVICE_AUDIO), "audio/mp4");
  });

  it("returns null when nothing the browser records is on the allowlist", () => {
    // Must be answerable BEFORE opening the microphone — otherwise somebody
    // records a message that can never be sent.
    assert.equal(pickRecordingType(() => true, ["audio/flac"]), null);
    assert.equal(pickRecordingType(() => false, SERVICE_AUDIO), null);
  });

  it("matches the allowlist on the BASE type, ignoring the codec suffix", () => {
    // The service normalises `audio/webm;codecs=opus` to `audio/webm`; a
    // client comparing the full string would reject its own best format.
    const onlyOpus = (type: string) => type === "audio/webm;codecs=opus";
    assert.equal(pickRecordingType(onlyOpus, ["audio/webm"]), "audio/webm;codecs=opus");
  });
});

describe("baseType", () => {
  it("strips the codec suffix and lowercases", () => {
    assert.equal(baseType("AUDIO/WEBM;codecs=opus"), "audio/webm");
    assert.equal(baseType("audio/mp4"), "audio/mp4");
  });
});

describe("formatElapsed", () => {
  it("reads as a clock, padded", () => {
    assert.equal(formatElapsed(0), "0:00");
    assert.equal(formatElapsed(7), "0:07");
    assert.equal(formatElapsed(64), "1:04");
    assert.equal(formatElapsed(-3), "0:00");
  });
});

describe("recordingFileName", () => {
  it("names the file for its container", () => {
    // `.webm`, never `.weba` — a CDN serves nothing at the latter, which is
    // what silently broke playback for every recorded note.
    assert.equal(recordingFileName("audio/webm;codecs=opus"), "voice-note.webm");
    assert.equal(recordingFileName("audio/mp4"), "voice-note.m4a");
  });
});
