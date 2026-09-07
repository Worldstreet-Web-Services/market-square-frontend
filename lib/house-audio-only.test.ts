import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  capturePlan,
  planHasVideo,
  previewConstraints,
  stageSources,
} from "../features/streams/lib/capture-plan.ts";

/**
 * "No camera, ever" is a PRODUCT PROMISE, so it is pinned like one.
 *
 * The brief is unambiguous and it was said twice: "Most people want to come on
 * at the convenience of whatever point — my bedroom, for example, but I don't
 * want to turn my video on… Don't put the video at all." A promise enforced by
 * convention survives exactly until the next person adds a toggle because it
 * seemed harmless, so it is enforced in two ways here:
 *
 *   1. The capture decision is a pure function, asserted below, and on the
 *      audio-only path the object handed to `createLocalTracks` has NO `video`
 *      key — not `video: false`, which is a value somebody can flip.
 *   2. The whole `features/houses` tree is read and searched for the names a
 *      camera path is built out of. That test fails on the edit rather than in
 *      production, which is the only place it is worth failing.
 */
describe("capturePlan", () => {
  it("omits the video key entirely when audio only", () => {
    const plan = capturePlan({ audio: { echoCancellation: true }, audioOnly: true });
    assert.equal("video" in plan, false);
    assert.equal(planHasVideo(plan), false);
    assert.deepEqual(Object.keys(plan), ["audio"]);
  });

  it("ignores a preferred camera on the audio-only path", () => {
    // The trap: a house host who once picked a camera in the green room still
    // has that deviceId in local storage. It must not be able to reach here.
    const plan = capturePlan({ audio: {}, audioOnly: true, preferredCamera: "cam-1" });
    assert.equal(planHasVideo(plan), false);
    assert.equal(JSON.stringify(plan).includes("cam-1"), false);
  });

  it("still asks for a camera on the stream path — houses must not regress streams", () => {
    assert.equal(planHasVideo(capturePlan({ audio: {} })), true);
    assert.deepEqual(capturePlan({ audio: {}, preferredCamera: "cam-1" }).video, {
      deviceId: "cam-1",
    });
  });
});

describe("stageSources", () => {
  it("is the microphone alone when the stage has no camera", () => {
    assert.deepEqual(stageSources({ withCamera: false }), ["microphone"]);
  });

  it("never contains a screen share on either path", () => {
    // Screen share is video by another name — "share a chart", "present
    // slides". There is no flag that adds it.
    for (const withCamera of [true, false]) {
      assert.equal(stageSources({ withCamera }).includes("screen_share" as never), false);
    }
  });

  it("still carries the camera for streams", () => {
    assert.deepEqual(stageSources({ withCamera: true }), ["microphone", "camera"]);
  });
});

describe("previewConstraints", () => {
  it("never prompts for a camera on an audio-only device check", () => {
    // A browser permission dialog naming a device the product does not use
    // contradicts the one promise louder than any copy can repair.
    const constraints = previewConstraints({ audio: {}, audioOnly: true, cameraId: "cam-1" });
    assert.equal("video" in constraints, false);
  });

  it("still previews a camera in the green room", () => {
    assert.deepEqual(previewConstraints({ audio: {}, cameraId: "cam-1" }).video, {
      deviceId: { exact: "cam-1" },
    });
  });
});

/* --------------------------------------------------------------------------
   The structural guard.
   -------------------------------------------------------------------------- */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const HOUSES = fileURLToPath(new URL("../features/houses", import.meta.url));
const FILES = sourceFiles(HOUSES).map((path) => ({
  path: path.slice(HOUSES.length + 1),
  // Comments are stripped before searching. Every one of these words appears
  // in this feature's prose precisely BECAUSE the camera is the thing being
  // ruled out, and a guard that cannot tell an explanation from a call would
  // force the explanations to be deleted.
  source: readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1"),
}));

/** Everything a camera or a screen share is actually built out of. */
const CAMERA_APIS = [
  "getUserMedia",
  "getDisplayMedia",
  "setCameraEnabled",
  "createLocalVideoTrack",
  "switchCamera",
  "videoTrack",
  "cameraTrack",
  "screenTrack",
  "screen_share",
  "facingMode",
  "<video",
  "HTMLVideoElement",
];

describe("features/houses contains no camera path", () => {
  it("reads at least the modules this guard is meant to cover", () => {
    // An empty tree passes every assertion below, which would make this whole
    // file a decoration. Fail loudly if the walk found nothing.
    assert.ok(FILES.length >= 8, `only found ${FILES.length} files under features/houses`);
    assert.ok(FILES.some((file) => file.path.endsWith("house-room.tsx")));
  });

  for (const api of CAMERA_APIS) {
    it(`never names ${api}`, () => {
      const offenders = FILES.filter((file) => file.source.includes(api)).map((f) => f.path);
      assert.deepEqual(offenders, [], `${api} appears in ${offenders.join(", ")}`);
    });
  }

  it("passes audioOnly wherever it publishes", () => {
    // usePublisher's camera branch is skipped by ONE boolean. A call site that
    // forgets it acquires a camera and publishes it, silently.
    for (const file of FILES) {
      if (!file.source.includes("usePublisher(")) continue;
      assert.match(
        file.source,
        /usePublisher\(\{[^}]*audioOnly:\s*true/s,
        `${file.path} calls usePublisher without audioOnly: true`
      );
    }
  });

  it("passes withCamera: false wherever it puts a guest on a seat", () => {
    for (const file of FILES) {
      if (!file.source.includes("useStage(")) continue;
      assert.match(
        file.source,
        /useStage\(\{[^}]*withCamera:\s*false/s,
        `${file.path} calls useStage without withCamera: false`
      );
    }
  });

  it("does not import the video stage or the player that renders it", () => {
    // Importing either is precisely how a camera affordance comes back: they
    // are video all the way down — tile backdrops, fit choices, the
    // screen-share branch, self-view mirroring.
    for (const file of FILES) {
      assert.equal(file.source.includes("components/live-stage"), false, file.path);
      assert.equal(file.source.includes("components/livekit-player"), false, file.path);
      assert.equal(file.source.includes("lib/stage-layout"), false, file.path);
      assert.equal(file.source.includes("components/green-room"), false, file.path);
      assert.equal(file.source.includes("components/live-cockpit"), false, file.path);
    }
  });
});

describe("features/houses uses design tokens, never raw colour", () => {
  it("contains no hex literal", () => {
    // The palette is opinionated and written down in app/globals.css. A hex in
    // a component is a colour nobody can repoint.
    const offenders = FILES.filter((file) => /#[0-9a-fA-F]{3,8}\b/.test(file.source)).map(
      (f) => f.path
    );
    assert.deepEqual(offenders, []);
  });

  it("does not borrow a semantic token for decoration", () => {
    // Each of these owns exactly one meaning. A speaking indicator is not
    // --color-live; a muted mic is not --color-down; there is no money in a
    // house at all, so --color-coin cannot appear.
    const borrowed = ["-live", "-coin", "-arena", "-like", "-up/", "-down"];
    for (const file of FILES) {
      for (const token of borrowed) {
        for (const prefix of ["bg", "text", "border", "stroke", "fill", "ring"]) {
          assert.equal(
            file.source.includes(`${prefix}${token}`),
            false,
            `${file.path} paints with ${prefix}${token}`
          );
        }
      }
    }
  });
});
