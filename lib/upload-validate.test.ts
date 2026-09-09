import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FALLBACK_LIMITS,
  PROXY_MAX_BYTES,
  formatBytes,
  formatDuration,
  shouldUploadDirect,
  uploadKind,
  validateUpload,
  validateVideoDuration,
} from "./upload-rules.ts";

/**
 * The reported bug: a 7.5 MB video was refused with a bare "too large".
 *
 * Two separate faults sat behind that. Vercel rejects any request body over
 * 4.5 MB before our code runs, so the proxy could never carry it — that is
 * what PROXY_MAX_BYTES and the direct-to-storage path address. And the message
 * named no limit and no actual size, which is what these assertions pin.
 */
const file = (type: string, bytes: number) => ({ type, size: bytes });

const MB = 1024 * 1024;

describe("formatBytes", () => {
  it("reads the way a person would say it", () => {
    assert.equal(formatBytes(7.5 * MB), "7.5 MB");
    assert.equal(formatBytes(100 * MB), "100 MB");
    assert.equal(formatBytes(512 * 1024), "512 KB");
  });
});

describe("validateUpload accepts what the service accepts", () => {
  it("takes the allowed image and video types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      assert.equal(validateUpload(file(type, MB), "media"), null, type);
      assert.equal(validateUpload(file(type, MB), "image"), null, type);
    }
    for (const type of ["video/mp4", "video/webm"]) {
      assert.equal(validateUpload(file(type, 20 * MB), "media"), null, type);
    }
  });

  it("passes a 7.5 MB video — the exact file from the report", () => {
    assert.equal(
      validateUpload(file("video/mp4", 7.5 * MB), "media"),
      null,
      "7.5 MB is well under the video cap; it must never be refused client-side"
    );
  });
});

describe("every rejection names the limit AND the real size", () => {
  it("says how big an oversized video actually is", () => {
    // Explicit limits, so the assertion states the numbers rather than
    // restating whatever the fallback happens to be today.
    const limits = { ...FALLBACK_LIMITS, maxVideoBytes: 100 * MB };
    const message = validateUpload(file("video/mp4", 140 * MB), "media", limits);
    assert.match(message ?? "", /100 MB/, "states the cap");
    assert.match(message ?? "", /140 MB/, "states the file's real size");
  });

  it("calls a GIF a GIF rather than 'an image'", () => {
    // GIFs blow the image cap far more often than stills, so the message has
    // to be recognisable as being about the file the reader just picked.
    const limits = { ...FALLBACK_LIMITS, maxImageBytes: 10 * MB };
    const message = validateUpload(file("image/gif", 12 * MB), "media", limits);
    assert.match(message ?? "", /GIFs/);
    assert.match(message ?? "", /10 MB/);
    assert.match(message ?? "", /12 MB/);
  });

  it("names the conversion for types the picker used to offer", () => {
    // The composer's accept attribute listed video/quicktime, which the
    // allowlist rejects — a guaranteed failure after the user had chosen.
    assert.match(validateUpload(file("video/quicktime", MB), "media") ?? "", /MP4/);
    assert.match(validateUpload(file("image/heic", MB), "media") ?? "", /JPEG/);
  });

  it("refuses a video in an image-only field without talking about size", () => {
    const message = validateUpload(file("video/mp4", MB), "image");
    assert.match(message ?? "", /image, not a video/);
  });
});

describe("the transport is chosen by SIZE, not by type", () => {
  // The constraint is a request-body limit. It does not care what the bytes
  // are, so neither may the routing rule.
  const direct = (bytes: number) => shouldUploadDirect(file("video/mp4", bytes));

  it("keeps small files on the proxy, whatever their type", () => {
    assert.equal(direct(2 * MB), false, "2 MB image");
    assert.equal(direct(PROXY_MAX_BYTES), false, "exactly at the limit stays proxied");
  });

  it("sends anything over the limit direct to storage", () => {
    assert.equal(direct(PROXY_MAX_BYTES + 1), true);
    assert.equal(direct(7.5 * MB), true, "the reported video must bypass the proxy");
  });

  it("stays under Vercel's hard 4.5 MB body limit with headroom", () => {
    assert.ok(
      PROXY_MAX_BYTES < 4.5 * MB,
      "FUNCTION_PAYLOAD_TOO_LARGE is a platform limit — the proxy cap must sit below it"
    );
    assert.ok(
      4.5 * MB - PROXY_MAX_BYTES >= 0.4 * MB,
      "multipart framing counts toward the body limit, so leave room for it"
    );
  });

  it("routes every acceptable video above the proxy cap direct", () => {
    // Otherwise the video cap we advertise is a lie on Vercel.
    for (const size of [5, 20, 60, 100, 400]) {
      assert.equal(direct(size * MB), true, `${size} MB video`);
    }
    assert.ok(FALLBACK_LIMITS.maxVideoBytes > PROXY_MAX_BYTES);
    assert.ok(FALLBACK_LIMITS.maxImageBytes > PROXY_MAX_BYTES);
  });
});

describe("uploadKind", () => {
  it("follows the allowlist, not the mime prefix", () => {
    assert.equal(uploadKind(file("video/mp4", 1)), "video");
    assert.equal(uploadKind(file("image/gif", 1)), "image");
  });
});

/**
 * The ADVISORY clip-length guard.
 *
 * The backend publishes `maxVideoSeconds` but enforces nothing — reading a
 * duration means demuxing the file, and on the presign path it never sees the
 * bytes. So this check is the only place the limit is applied, which makes two
 * things matter more than usual: the message has to be actionable (it names
 * the limit AND the clip's real length), and an unreadable duration must not
 * become a rejection.
 */
describe("validateVideoDuration", () => {
  const limits = { ...FALLBACK_LIMITS, maxVideoSeconds: 90 };

  it("passes anything at or under the limit", () => {
    for (const seconds of [1, 30, 89, 90]) {
      assert.equal(validateVideoDuration(seconds, limits), null, `${seconds}s`);
    }
  });

  it("names the limit AND the clip's actual length", () => {
    const message = validateVideoDuration(154, limits);
    assert.match(message ?? "", /1m 30s/, "states the limit");
    assert.match(message ?? "", /2m 34s/, "states the clip's real length");
    assert.match(message ?? "", /Trim it/, "says what to do next");
  });

  it("does NOT reject when the duration could not be read", () => {
    // The browser refuses some containers, and metadata can never arrive. A
    // failed probe is OUR problem — blocking the upload for it would leave the
    // user with an error they cannot act on, and the byte cap still applies.
    for (const unreadable of [null, Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      assert.equal(validateVideoDuration(unreadable, limits), null, String(unreadable));
    }
  });

  it("follows a limit the server changed", () => {
    // The value is fetched, so a 30 s environment must tighten this check
    // without a client deploy.
    assert.match(
      validateVideoDuration(45, { ...FALLBACK_LIMITS, maxVideoSeconds: 30 }) ?? "",
      /30s/
    );
  });
});

describe("formatDuration reads the way a person would say it", () => {
  it("uses seconds under a minute and minutes above", () => {
    assert.equal(formatDuration(45), "45s");
    assert.equal(formatDuration(60), "1m");
    assert.equal(formatDuration(90), "1m 30s");
    assert.equal(formatDuration(154), "2m 34s");
    assert.equal(formatDuration(120), "2m");
  });
});

/**
 * Audio is only acceptable where audio is actually accepted.
 *
 * THE BUG THIS PINS: `uploadFile`'s `accept` defaults to "media" (image +
 * video), and both chat call sites — the attachment panel and the voice
 * recorder — took that default. So a voice note passed the picker's own check
 * and was then refused by our own uploader, one gate later, with a message
 * naming only images and video. The user saw "Use an image (JPEG, PNG, WebP,
 * GIF) or a video (MP4, WebM)." after recording one.
 *
 * The asymmetry is deliberate and must stay: a voice note is a message, never
 * a post or an avatar. Widening "media" to admit audio would have fixed the
 * symptom by letting a voice note be uploaded as somebody's profile picture.
 */
describe("audio is accepted only on the attachment path", () => {
  const voiceNote = { type: "audio/webm", size: 200 * 1024 };

  it("takes a voice note as a chat attachment", () => {
    assert.equal(validateUpload(voiceNote, "attachment", FALLBACK_LIMITS), null);
  });

  it("refuses the same file as post media or as an avatar", () => {
    // This is the exact rejection the chat composer was producing.
    assert.equal(
      validateUpload(voiceNote, "media", FALLBACK_LIMITS),
      "Use an image (JPEG, PNG, WebP, GIF) or a video (MP4, WebM)."
    );
    assert.equal(
      validateUpload(voiceNote, "image", FALLBACK_LIMITS),
      "Use a JPEG, PNG, WebP or GIF image."
    );
  });

  it("names the AUDIO cap when a voice note is too big, not the video one", () => {
    const huge = { type: "audio/mpeg", size: FALLBACK_LIMITS.maxAudioBytes + 1 };
    const message = validateUpload(huge, "attachment", FALLBACK_LIMITS);
    assert.match(String(message), /Voice notes must be under/);
    // Under the 200 MB video cap, so only a separate audio cap can catch it —
    // which is the whole reason audio has its own number.
    assert.ok(huge.size < FALLBACK_LIMITS.maxVideoBytes);
  });

  it("accepts what MediaRecorder actually produces, codec parameter and all", () => {
    // THE SECOND BUG: `MediaRecorder` hands back `audio/webm;codecs=opus`, and
    // the File built from that blob carries the parameter on `.type`. Compared
    // verbatim against an allowlist holding plain `audio/webm`, every recorded
    // voice note was refused — and `uploadKind` fell through to its default and
    // called the recording an IMAGE, which would have applied the image cap and
    // drawn the wrong bubble.
    const recorded = { type: "audio/webm;codecs=opus", size: 200 * 1024 };
    assert.equal(validateUpload(recorded, "attachment", FALLBACK_LIMITS), null);
    assert.equal(uploadKind(recorded, FALLBACK_LIMITS), "audio");

    // The parameter is metadata about the encoding, never part of the type's
    // identity — so it must not smuggle a file past the accept rules either.
    assert.notEqual(validateUpload(recorded, "media", FALLBACK_LIMITS), null);

    // Case is not identity either.
    assert.equal(
      uploadKind({ type: "AUDIO/WEBM;codecs=opus", size: 1024 }, FALLBACK_LIMITS),
      "audio"
    );
  });

  it("types every recordable container as audio, not video", () => {
    // `uploadKind` decides which cap applies and what the bubble draws. WebM
    // is both a video and an audio container, so this is the one that could
    // silently go wrong.
    for (const type of FALLBACK_LIMITS.audioContentTypes) {
      assert.equal(uploadKind({ type, size: 1024 }, FALLBACK_LIMITS), "audio", type);
    }
    assert.equal(uploadKind({ type: "video/webm", size: 1024 }, FALLBACK_LIMITS), "video");
  });
});
