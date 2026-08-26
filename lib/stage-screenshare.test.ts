import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SOURCE_CAMERA,
  SOURCE_SCREEN,
  buildStage,
  buildStageLayout,
  type StageParticipant,
  type StagePublication,
  type StageRoom,
} from "../features/streams/lib/stage.ts";

/**
 * The reported bug: "when I share the board I can't see their face."
 *
 * Ark publishes a screen share and a camera as TWO publications on one
 * participant, told apart only by `source`. The stage read the first video
 * publication and attached it, so one source silently replaced the other.
 */
const HOST = "host-1";

const pub = (sid: string, source: string, muted = false): StagePublication => ({
  trackSid: sid,
  isMuted: muted,
  source,
  track: { sid },
});

function person(
  identity: string,
  video: StagePublication[],
  audio: StagePublication[] = [],
  extra: Partial<StageParticipant> = {}
): StageParticipant {
  return {
    identity,
    permissions: { canPublish: true },
    name: identity,
    videoTrackPublications: new Map(video.map((p) => [p.trackSid, p])),
    audioTrackPublications: new Map(audio.map((p) => [p.trackSid, p])),
    ...extra,
  };
}

const room = (...people: StageParticipant[]): StageRoom => ({
  localParticipant: people[0],
  remoteParticipants: new Map(people.slice(1).map((p) => [p.identity, p])),
});

const stageOf = (...people: StageParticipant[]) => buildStage(room(...people), HOST);

describe("a participant's camera and screen are kept apart", () => {
  it("resolves both when both are published", () => {
    const [slot] = stageOf(person(HOST, [pub("cam", SOURCE_CAMERA), pub("scr", SOURCE_SCREEN)]));
    assert.equal(slot.cameraTrack?.trackSid, "cam");
    assert.equal(slot.screenTrack?.trackSid, "scr");
  });

  it("does not let publication ORDER decide which survives", () => {
    // The old code took the first entry, so this ordering silently swapped
    // which source reached the screen.
    const [slot] = stageOf(person(HOST, [pub("scr", SOURCE_SCREEN), pub("cam", SOURCE_CAMERA)]));
    assert.equal(slot.cameraTrack?.trackSid, "cam");
    assert.equal(slot.screenTrack?.trackSid, "scr");
  });

  it("treats a source-less publication as a camera", () => {
    // Older publishers leave source unset. Guessing "screen" would promote a
    // face to the main stage and demote everyone else.
    const [slot] = stageOf(person(HOST, [{ trackSid: "v", isMuted: false, track: {} }]));
    assert.equal(slot.cameraTrack?.trackSid, "v");
    assert.equal(slot.screenTrack, null);
    assert.equal(slot.cameraOff, false);
  });

  it("a screen-only publisher is not reported as camera-on", () => {
    const [slot] = stageOf(person(HOST, [pub("scr", SOURCE_SCREEN)]));
    assert.equal(slot.cameraTrack, null);
    assert.equal(slot.cameraOff, true, "no face — the strip must show their avatar");
    assert.equal(slot.state, "live", "they ARE publishing, just not a camera");
  });
});

describe("layout: screens take the stage, faces keep a tile", () => {
  it("with no share, cameras are the stage and there is no strip", () => {
    const layout = buildStageLayout(stageOf(person(HOST, [pub("c1", SOURCE_CAMERA)])));
    assert.equal(layout.screenSharing, false);
    assert.equal(layout.primary.length, 1);
    assert.equal(layout.primary[0].kind, "camera");
    assert.equal(layout.secondary.length, 0);
  });

  it("the sharer appears TWICE — screen on stage, face in the strip", () => {
    // This is the whole bug: the reporter wanted the board AND the opponent.
    const layout = buildStageLayout(
      stageOf(
        person(HOST, [pub("cam", SOURCE_CAMERA), pub("scr", SOURCE_SCREEN)]),
        person("guest", [pub("gcam", SOURCE_CAMERA)])
      )
    );
    assert.equal(layout.screenSharing, true);
    assert.deepEqual(
      layout.primary.map((t) => t.publication?.trackSid),
      ["scr"]
    );
    assert.deepEqual(
      layout.secondary.map((t) => t.publication?.trackSid),
      ["cam", "gcam"],
      "every participant keeps a face, the sharer included"
    );
  });

  it("labels the screen with its owner so the pairing is readable", () => {
    const layout = buildStageLayout(
      stageOf(person(HOST, [pub("cam", SOURCE_CAMERA), pub("scr", SOURCE_SCREEN)]))
    );
    assert.equal(layout.primary[0].label, `${HOST}'s screen`);
    assert.equal(layout.secondary[0].label, HOST);
  });

  it("keeps tile keys stable so starting a share never remounts a face", () => {
    // A remount detaches and re-attaches the video element — that is the
    // black flash. The camera tile's key must not change when a share starts.
    const before = buildStageLayout(stageOf(person(HOST, [pub("cam", SOURCE_CAMERA)])));
    const after = buildStageLayout(
      stageOf(person(HOST, [pub("cam", SOURCE_CAMERA), pub("scr", SOURCE_SCREEN)]))
    );
    const cameraKey = (l: ReturnType<typeof buildStageLayout>) =>
      [...l.primary, ...l.secondary].find((t) => t.kind === "camera")?.key;
    assert.equal(cameraKey(before), cameraKey(after));
    assert.equal(cameraKey(after), `${HOST}:camera`);
  });

  it("carries several simultaneous screens", () => {
    // N publishers × 2 sources — the opponent joining as a co-publisher is next.
    const layout = buildStageLayout(
      stageOf(
        person(HOST, [pub("s1", SOURCE_SCREEN)]),
        person("g", [pub("s2", SOURCE_SCREEN), pub("c2", SOURCE_CAMERA)])
      )
    );
    assert.equal(layout.primary.length, 2);
    assert.equal(layout.secondary.length, 2, "both keep a face tile");
  });

  it("a muted screen share does not take the stage", () => {
    // Stopping a share mutes the publication before it is unpublished; the
    // layout must fall back to cameras rather than showing a frozen board.
    const layout = buildStageLayout(
      stageOf(person(HOST, [pub("cam", SOURCE_CAMERA), pub("scr", SOURCE_SCREEN, true)]))
    );
    assert.equal(layout.screenSharing, false);
    assert.equal(layout.primary[0].kind, "camera");
  });

  it("an audio-only guest still holds a tile while someone shares", () => {
    const layout = buildStageLayout(
      stageOf(
        person(HOST, [pub("scr", SOURCE_SCREEN)]),
        person("mic-only", [], [pub("a", "microphone")])
      )
    );
    assert.equal(layout.secondary.length, 2);
    assert.ok(layout.secondary.some((t) => t.slot.identity === "mic-only"));
  });
});

describe("the demo stage exercises the reported scenario", () => {
  it("renders a board on stage and every face in the strip", async () => {
    const { demoStageRoom, DEMO_HOST_IDENTITY } = await import("./fixtures/stage.ts");
    const layout = buildStageLayout(buildStage(demoStageRoom(), DEMO_HOST_IDENTITY));

    assert.equal(layout.screenSharing, true);
    assert.equal(layout.primary.length, 1, "the shared board is the stage");
    assert.equal(layout.primary[0].kind, "screen");
    assert.match(layout.primary[0].label, /screen$/);

    // Three faces: the sharer, the opponent, and the audio-only spectator.
    assert.equal(layout.secondary.length, 3);
    assert.ok(
      layout.secondary.some((t) => t.slot.identity === DEMO_HOST_IDENTITY),
      "the person sharing must still show their face — this is the bug"
    );
  });
});
