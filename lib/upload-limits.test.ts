import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  FALLBACK_LIMITS,
  getUploadLimits,
  resetUploadLimits,
  setUploadLimits,
  validateUpload,
  validateVideoDuration,
} from "./upload-rules.ts";
import {
  UPLOAD_LIMITS_PATH,
  ensureUploadLimits,
  resetUploadLimitsCache,
} from "./upload-limits.ts";

/**
 * The bug these close is a CONTRACT WITH TWO OWNERS.
 *
 * The size caps and the content-type allowlist were written out by hand here
 * and, separately, in the backend that enforces them. Raise the server alone
 * and this client refuses a photo the server would have stored; raise the
 * client alone and the user watches a 300 MB upload complete and then fail.
 * Neither shows up in review and neither fails CI, because the two copies live
 * in repositories that never see each other.
 *
 * So the server publishes them and we read them — while keeping the two
 * properties that made the client check worth having: it runs BEFORE any byte
 * leaves the machine, and its message names both the cap and the file's real
 * size.
 */

const MB = 1024 * 1024;
const file = (type: string, bytes: number) => ({ type, size: bytes });

/** An envelope-shaped Response, without pulling in a fetch mock library. */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const SERVER_LIMITS = {
  maxImageBytes: 25 * MB,
  maxVideoBytes: 200 * MB,
  imageContentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  videoContentTypes: ["video/mp4", "video/webm"],
  // Voice notes. Audio joined the published contract when chat attachments
  // did — this fixture stands in for what the service actually serves, so it
  // carries the same fields the service does.
  maxAudioBytes: 10 * MB,
  audioContentTypes: ["audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/wav"],
  maxVideoSeconds: 90,
};

beforeEach(() => {
  resetUploadLimits();
  resetUploadLimitsCache();
});

describe("ensureUploadLimits reads the contract from the backend", () => {
  it("asks the BFF once and adopts what it returns", async () => {
    const calls: string[] = [];
    const limits = await ensureUploadLimits(async (url) => {
      calls.push(url);
      return jsonResponse({ success: true, data: SERVER_LIMITS });
    });

    assert.deepEqual(calls, [UPLOAD_LIMITS_PATH]);
    assert.deepEqual(limits, SERVER_LIMITS);
    assert.deepEqual(getUploadLimits(), SERVER_LIMITS);
  });

  it("shares one request between concurrent callers", async () => {
    // The composer and an avatar picker can open in the same tick. Two
    // requests for a value that cannot differ is just noise.
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return jsonResponse({ success: true, data: SERVER_LIMITS });
    };
    await Promise.all([ensureUploadLimits(fetcher), ensureUploadLimits(fetcher)]);
    await ensureUploadLimits(fetcher);
    assert.equal(calls, 1);
  });

  it("validates against the SERVER's caps, not the compiled-in ones", async () => {
    // The whole point: an operator raises the cap in the backend's env and
    // this client honours it with no deploy of ours.
    await ensureUploadLimits(async () =>
      jsonResponse({ success: true, data: { ...SERVER_LIMITS, maxVideoBytes: 800 * MB } })
    );
    assert.equal(validateUpload(file("video/mp4", 700 * MB), "media"), null);

    // And downward, which is the case that actually protects users: an
    // operator lowering the video cap must tighten this check too.
    resetUploadLimitsCache();
    await ensureUploadLimits(async () =>
      jsonResponse({ success: true, data: { ...SERVER_LIMITS, maxVideoBytes: 150 * MB } })
    );
    const message = validateUpload(file("video/mp4", 300 * MB), "media");
    assert.match(message ?? "", /150 MB/, "states the server's cap");
    assert.match(message ?? "", /300 MB/, "states the file's real size");
  });

  it("takes the advisory clip length from the server too", async () => {
    // It is advisory — nothing upstream enforces it — which is exactly why it
    // must be FETCHED rather than compiled in: this client is the only thing
    // applying it, so a stale copy is the whole guard being wrong.
    await ensureUploadLimits(async () =>
      jsonResponse({ success: true, data: { ...SERVER_LIMITS, maxVideoSeconds: 30 } })
    );
    assert.equal(getUploadLimits().maxVideoSeconds, 30);
    const message = validateVideoDuration(75);
    assert.match(message ?? "", /30s/, "states the limit");
    assert.match(message ?? "", /1m 15s/, "states the clip's real length");
  });

  it("honours a content-type allowlist the server changes", async () => {
    await ensureUploadLimits(async () =>
      jsonResponse({
        success: true,
        data: { ...SERVER_LIMITS, videoContentTypes: ["video/mp4", "video/webm", "video/ogg"] },
      })
    );
    assert.equal(validateUpload(file("video/ogg", MB), "media"), null);
  });
});

describe("a failed fetch falls back instead of breaking the composer", () => {
  const fallsBack = async (fetcher: () => Promise<Response>) => {
    const limits = await ensureUploadLimits(fetcher);
    assert.deepEqual(limits, FALLBACK_LIMITS);
    assert.deepEqual(getUploadLimits(), FALLBACK_LIMITS);
    // The user can still pick a file and still gets a real answer.
    assert.equal(validateUpload(file("image/jpeg", 5 * MB), "media"), null);
  };

  it("survives a network error", async () => {
    await fallsBack(async () => {
      throw new Error("offline");
    });
  });

  it("survives a non-2xx", async () => {
    await fallsBack(async () => jsonResponse({ success: false }, 503));
  });

  it("survives an error envelope and unparseable JSON", async () => {
    await fallsBack(async () => jsonResponse({ success: false, error: { code: "OOPS" } }));
    resetUploadLimitsCache();
    await fallsBack(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError("not json");
          },
        }) as unknown as Response
    );
  });

  it("retries on the next attempt rather than pinning the session", async () => {
    // One flaky request must not cost the user correct limits for as long as
    // the tab is open.
    let attempt = 0;
    const fetcher = async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("flaky");
      return jsonResponse({ success: true, data: SERVER_LIMITS });
    };
    assert.deepEqual(await ensureUploadLimits(fetcher), FALLBACK_LIMITS);
    assert.deepEqual(await ensureUploadLimits(fetcher), SERVER_LIMITS);
    assert.equal(attempt, 2);
  });

  it("keeps the fallback in step with the server's defaults", () => {
    // A fallback that lags the server is the old bug with extra steps. If the
    // service's defaults change, this fails and someone updates both.
    assert.equal(FALLBACK_LIMITS.maxImageBytes, 25 * MB);
    // 200, matching the service — deliberately below the 500 it would accept,
    // because we do not transcode and the feed autoplays clips.
    assert.equal(FALLBACK_LIMITS.maxVideoBytes, 200 * MB);
    assert.equal(FALLBACK_LIMITS.maxVideoSeconds, 90);
  });
});

describe("setUploadLimits refuses a payload that would break validation", () => {
  it("ignores zero, negative and non-numeric caps", () => {
    // A cap of 0 rejects EVERY file the user picks, and the message blames
    // their file. Far worse than a stale but sane number.
    for (const bad of [0, -1, Number.NaN, "25" as unknown as number, null as unknown as number]) {
      resetUploadLimits();
      setUploadLimits({ ...SERVER_LIMITS, maxImageBytes: bad });
      assert.equal(getUploadLimits().maxImageBytes, FALLBACK_LIMITS.maxImageBytes, String(bad));
    }
  });

  it("ignores an empty or malformed allowlist", () => {
    setUploadLimits({ ...SERVER_LIMITS, imageContentTypes: [] });
    assert.deepEqual(getUploadLimits().imageContentTypes, FALLBACK_LIMITS.imageContentTypes);
    setUploadLimits({ ...SERVER_LIMITS, videoContentTypes: [1, 2] as unknown as string[] });
    assert.deepEqual(getUploadLimits().videoContentTypes, FALLBACK_LIMITS.videoContentTypes);
  });

  it("ignores a nonsensical clip length", () => {
    // A `maxVideoSeconds` of 0 would reject every video the user picks and
    // blame their clip's length.
    for (const bad of [0, -30, Number.NaN]) {
      resetUploadLimits();
      setUploadLimits({ ...SERVER_LIMITS, maxVideoSeconds: bad });
      assert.equal(getUploadLimits().maxVideoSeconds, FALLBACK_LIMITS.maxVideoSeconds);
    }
  });

  it("takes the good fields out of a partial payload", () => {
    // Field-by-field, so one bad number does not discard a whole response.
    setUploadLimits({ maxVideoBytes: 200 * MB, maxImageBytes: -5 });
    assert.equal(getUploadLimits().maxVideoBytes, 200 * MB);
    assert.equal(getUploadLimits().maxImageBytes, FALLBACK_LIMITS.maxImageBytes);
  });
});
