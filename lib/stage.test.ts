import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CROP_BUDGET,
  buildStage,
  chooseFit,
  cropLoss,
  remoteAudioSlots,
  type StageParticipant,
  type StagePublication,
  type StageRoom,
} from "../features/streams/lib/stage.ts";

/**
 * The production bug: the host approves a guest, the guest's camera turns on
 * and they see their own face, but nobody else ever sees or hears them. Every
 * renderer resolved ONE video source, so the second publisher had no DOM node,
 * and the host cockpit had no remote path at all.
 *
 * These cases pin the replacement: the stage is a list derived from the publish
 * GRANT, audio is independent of video, and a slot with no media is still a
 * slot.
 */

const HOST = "host-user";

function publication(sid: string, muted = false): StagePublication {
  return { trackSid: sid, isMuted: muted, isSubscribed: true, track: {} };
}

function participant(
  identity: string,
  overrides: Partial<StageParticipant> = {}
): StageParticipant {
  return {
    identity,
    isLocal: false,
    permissions: { canPublish: false },
    videoTrackPublications: new Map(),
    audioTrackPublications: new Map(),
    ...overrides,
  };
}

function room(local: StageParticipant, ...remotes: StageParticipant[]): StageRoom {
  return {
    localParticipant: local,
    remoteParticipants: new Map(remotes.map((r) => [r.identity, r])),
  };
}

const publishing = (identity: string, extra: Partial<StageParticipant> = {}) =>
  participant(identity, {
    permissions: { canPublish: true },
    videoTrackPublications: new Map([["v", publication(`${identity}-v`)]]),
    audioTrackPublications: new Map([["a", publication(`${identity}-a`)]]),
    ...extra,
  });

describe("buildStage", () => {
  it("puts the host in slot 0", () => {
    const stage = buildStage(
      room(participant("viewer"), publishing("guest-1", { joinedAt: 2000 }), publishing(HOST, { joinedAt: 1000 })),
      HOST
    );
    assert.deepEqual(
      stage.map((slot) => slot.identity),
      [HOST, "guest-1"]
    );
    assert.equal(stage[0].role, "host");
    assert.equal(stage[1].role, "guest");
  });

  it("keeps the host in slot 0 even when a guest joined first", () => {
    const stage = buildStage(
      room(publishing(HOST, { joinedAt: 9999, isLocal: true }), publishing("guest-1", { joinedAt: 1 })),
      HOST
    );
    assert.equal(stage[0].identity, HOST);
  });

  it("keeps the host on stage before their own permissions have been read", () => {
    // The documented LiveKit race: permissions arrive after the first render.
    const stage = buildStage(room(participant(HOST, { isLocal: true, permissions: null })), HOST);
    assert.equal(stage.length, 1);
    assert.equal(stage[0].role, "host");
  });

  it("orders guests by join order, not map order", () => {
    const stage = buildStage(
      room(
        publishing(HOST, { isLocal: true }),
        publishing("later", { joinedAt: new Date(5000) }),
        publishing("earlier", { joinedAt: new Date(2000) })
      ),
      HOST
    );
    assert.deepEqual(stage.map((s) => s.identity), [HOST, "earlier", "later"]);
  });

  it("excludes plain viewers — membership is the publish grant", () => {
    const stage = buildStage(
      room(participant("me", { isLocal: true }), publishing(HOST), participant("lurker")),
      HOST
    );
    assert.deepEqual(stage.map((s) => s.identity), [HOST]);
  });

  it("gives an approved-but-not-yet-publishing guest a pending slot", () => {
    // The exact window the old 'has a video track' test dropped on the floor.
    const stage = buildStage(
      room(publishing(HOST, { isLocal: true }), participant("guest-1", { permissions: { canPublish: true } })),
      HOST
    );
    assert.equal(stage.length, 2);
    assert.equal(stage[1].state, "approved-pending");
    assert.equal(stage[1].cameraTrack, null);
    assert.equal(stage[1].audioTrack, null);
    assert.equal(stage[1].cameraOff, true);
  });

  it("gives a camera-off guest an avatar slot, never a dropped slot", () => {
    const stage = buildStage(
      room(
        publishing(HOST, { isLocal: true }),
        participant("guest-1", {
          permissions: { canPublish: true },
          videoTrackPublications: new Map([["v", publication("g-v", true)]]),
          audioTrackPublications: new Map([["a", publication("g-a")]]),
        })
      ),
      HOST
    );
    assert.equal(stage[1].cameraOff, true);
    assert.equal(stage[1].state, "live");
    assert.notEqual(stage[1].audioTrack, null);
  });

  it("gives an audio-only guest a slot with audio and no video", () => {
    const stage = buildStage(
      room(
        publishing(HOST, { isLocal: true }),
        participant("guest-1", {
          permissions: { canPublish: true },
          audioTrackPublications: new Map([["a", publication("g-a")]]),
        })
      ),
      HOST
    );
    assert.equal(stage.length, 2);
    assert.equal(stage[1].cameraTrack, null);
    assert.equal(stage[1].audioTrack?.trackSid, "g-a");
    assert.equal(stage[1].isMuted, false);
    assert.equal(stage[1].cameraOff, true);
  });

  it("treats a participant with no audio publication as muted", () => {
    const stage = buildStage(
      room(
        publishing(HOST, { isLocal: true }),
        participant("guest-1", {
          permissions: { canPublish: true },
          videoTrackPublications: new Map([["v", publication("g-v")]]),
        })
      ),
      HOST
    );
    assert.equal(stage[1].isMuted, true);
    assert.equal(stage[1].cameraOff, false);
  });

  it("removes the slot when the guest is demoted", () => {
    const guest = publishing("guest-1");
    const live = room(publishing(HOST, { isLocal: true }), guest);
    assert.equal(buildStage(live, HOST).length, 2);
    // Remove-from-stage is a server-side canPublish:false; LiveKit mutates
    // permissions in place and unpublishes the tracks.
    guest.permissions = { canPublish: false };
    guest.videoTrackPublications = new Map();
    guest.audioTrackPublications = new Map();
    assert.deepEqual(buildStage(live, HOST).map((s) => s.identity), [HOST]);
  });

  it("never lists the same identity twice", () => {
    const me = publishing(HOST, { isLocal: true });
    const stage = buildStage(
      { localParticipant: me, remoteParticipants: new Map([[HOST, me]]) },
      HOST
    );
    assert.equal(stage.length, 1);
  });

  it("marks the local participant so the renderer never plays our own mic back", () => {
    const stage = buildStage(
      room(publishing("guest-me", { isLocal: true }), publishing(HOST)),
      HOST
    );
    const mine = stage.find((slot) => slot.identity === "guest-me");
    assert.equal(mine?.isLocal, true);
    assert.deepEqual(
      remoteAudioSlots(stage).map((slot) => slot.identity),
      [HOST]
    );
  });

  it("carries every publisher's audio slot independently of video", () => {
    const stage = buildStage(
      room(
        participant("me", { isLocal: true }),
        publishing(HOST),
        participant("guest-1", {
          permissions: { canPublish: true },
          audioTrackPublications: new Map([["a", publication("g1-a")]]),
        })
      ),
      HOST
    );
    // Two audio elements are owed, even though only one participant has video.
    assert.equal(remoteAudioSlots(stage).length, 2);
    assert.equal(stage.filter((slot) => slot.cameraTrack).length, 1);
  });
});

/**
 * Structural assertions on the renderer.
 *
 * `buildStage` being right is not enough — the bug was in how the result was
 * consumed. These read the source and pin the two shapes that made the guest
 * invisible and inaudible, because both are easy to regress by "simplifying"
 * one map back into a lookup.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(import.meta.dirname, "..", path), "utf8");

const stageView = source("features/streams/components/live-stage.tsx");
const player = source("features/streams/components/livekit-player.tsx");
const slotsHook = source("features/streams/hooks/use-stage-slots.ts");
const guestStage = source("features/streams/hooks/use-stage.ts");
const cockpit = source("features/streams/components/live-cockpit.tsx");

describe("the stage renderer, by construction", () => {
  it("maps over the slot list instead of picking one participant", () => {
    // The stage is now per-SOURCE, so it maps two tile lists (screens on the
    // main stage, faces in the strip) rather than one list of participants.
    // The rule is unchanged: map over a list, never resolve "the" participant.
    assert.match(stageView, /primary\.map\(/, "the main stage must be a map");
    assert.match(stageView, /secondary\.map\(/, "the camera strip must be a map");
    for (const antiPattern of [
      /remoteParticipants\[0\]/,
      /remoteParticipants\.values\(\)\)\[0\]/,
      /\.values\(\)\.next\(\)/,
      /const remote(Participant)? =/,
    ]) {
      assert.doesNotMatch(stageView, antiPattern, `single-source lookup: ${antiPattern}`);
    }
  });

  it("attaches audio from its own map, independent of any video element", () => {
    assert.match(stageView, /remoteAudioSlots\(/);
    assert.match(stageView, /audio\.map\(\(slot\) => \(\s*<RemoteAudio/);
    // The audio map must not be nested inside the tile map: audio for a guest
    // with no camera has to survive the tile rendering an avatar instead.
    const tileMap = stageView.indexOf("slots.map(");
    const audioMap = stageView.indexOf("audio.map(");
    assert.ok(audioMap > tileMap, "audio must be mounted outside the tile map");
    assert.ok(
      !stageView.slice(tileMap, audioMap).includes("<RemoteAudio"),
      "audio elements must not live inside a tile"
    );
    // And the video element must never be the thing carrying sound.
    assert.match(stageView, /element\.muted = true;/);
  });

  it("renders an avatar tile rather than a black rectangle when the camera is off", () => {
    assert.match(stageView, /hideVideo && \(/);
    assert.match(stageView, /<Avatar/);
  });

  it("offers a real user gesture for blocked autoplay", () => {
    assert.match(stageView, /startAudio\(\)/);
    assert.match(stageView, /Tap to turn on sound/);
  });

  it("enumerates the participants already in the room, not just events", () => {
    assert.match(slotsHook, /remoteParticipants\.values\(\)/);
    assert.match(slotsHook, /RoomEvent\.ParticipantPermissionsChanged/);
    // Every handler funnels into one rebuild, so adding an event can never
    // introduce a second, subtly different update path.
    assert.match(slotsHook, /for \(const event of events\) room\.on\(event, recompute\);/);
  });

  it("no longer renders from the viewer player's own track-subscribed handler", () => {
    assert.match(player, /<LiveStage/);
    assert.doesNotMatch(player, /RoomEvent\.TrackSubscribed/);
    // The terminal duplicate-identity handling and the registry claim stay.
    assert.match(player, /DisconnectReason\.DUPLICATE_IDENTITY/);
    assert.match(player, /registerRoom\(streamId, instance\)/);
    assert.match(player, /unregisterRoom\(streamId, room\)/);
  });

  it("gives the host cockpit a remote path at all", () => {
    // This was the whole bug on the host's side: the cockpit rendered one
    // element, its own preview, and attached nothing from anybody else.
    assert.match(cockpit, /<LiveStage/);
    assert.match(cockpit, /hostIdentity=\{stream\.ownerId\}/);
    assert.match(cockpit, /onRemoveGuest=\{removeGuest\}/);
    assert.match(cockpit, /action: "remove"/);
  });

  it("makes the guest publish only after the grant, idempotently, with one retry", () => {
    assert.match(guestStage, /RoomEvent\.ParticipantPermissionsChanged/);
    assert.match(guestStage, /localParticipant\.permissions\?\.canPublish === true/);
    assert.match(guestStage, /if \(!canPublish\) return;/);
    assert.match(guestStage, /enableOnce\(\(\) => room\.localParticipant\.setMicrophoneEnabled\(true\)\)/);
    assert.match(guestStage, /enableOnce\(\(\) => room\.localParticipant\.setCameraEnabled\(true\)\)/);
    // Exactly one retry — a loop here is how you get an eviction storm.
    assert.equal((guestStage.match(/await enable\(\);/g) ?? []).length, 2);
  });
});

describe("the stream room keeps Ark broadcasts watch-only", () => {
  const room = source("features/streams/components/stream-room.tsx");

  it("gates BOTH speaker-request entry points on the same flag", () => {
    // Desktop header and mobile rail. One of them keeping the control would
    // put a dead end back on exactly one breakpoint.
    const guarded = room.match(/!watchOnly && me\.data\?\.id !== data\.ownerId/g) ?? [];
    assert.equal(guarded.length, 2, "both GuestSpeakerControl sites must be gated");
  });

  it("derives the flag from the deep link, not from a game list", () => {
    assert.match(room, /const watchOnly = isArkOriginated\(data\.deepLink\)/);
    assert.doesNotMatch(room, /"chess"|"arkball"|"last-standing"/, "no game names in the room");
  });

  it("offers the way into Ark on both breakpoints", () => {
    // The header CTA is lg:block, so the mobile rail needs its own.
    assert.match(room, /Join the match in Ark/);
    assert.match(room, /aria-label="Join the match in Ark"/);
  });
});

/**
 * Fit selection.
 *
 * The reported bug: a host shares a wide source and viewers get its middle
 * third, because every tile filled its box. The decision is a pure function of
 * (source kind, intrinsic aspect, tile aspect) precisely so it can be argued
 * about here rather than inspected in a rendered DOM.
 */
const ASPECT = {
  ultrawide: 21 / 9, // 2.333
  desktop: 16 / 10, // 1.6 — a typical shared screen
  wide: 16 / 9, // 1.778
  classic: 4 / 3, // 1.333
  square: 1,
  portrait: 9 / 16, // 0.5625 — the mobile stage
};

describe("chooseFit", () => {
  const fit = (isScreenShare: boolean, sourceAspect: number | null, tileAspect: number | null) =>
    chooseFit({ isScreenShare, sourceAspect, tileAspect });

  it("never crops a screen share, whatever the tile shape", () => {
    for (const tile of Object.values(ASPECT)) {
      for (const source of Object.values(ASPECT)) {
        assert.equal(fit(true, source, tile), "contain", `screen ${source} in ${tile}`);
      }
    }
  });

  it("letterboxes a screen share even when it matches the tile exactly", () => {
    // Deliberate: `contain` at a matching aspect produces no bars anyway, and
    // making it conditional is how the rule quietly acquires an exception.
    assert.equal(fit(true, ASPECT.wide, ASPECT.wide), "contain");
  });

  it("fills when a camera's aspect matches its tile", () => {
    assert.equal(fit(false, ASPECT.wide, ASPECT.wide), "cover");
    assert.equal(fit(false, ASPECT.portrait, ASPECT.portrait), "cover");
    assert.equal(fit(false, ASPECT.square, ASPECT.square), "cover");
  });

  it("fills through a near-match, where the crop is only margin", () => {
    // 16:9 in 16:10 → ratio 1.11, ~10% lost: inside the title-safe convention.
    assert.equal(fit(false, ASPECT.wide, ASPECT.desktop), "cover");
    // 3:2 in 16:9 → ratio 1.19, ~16%: still under budget.
    assert.equal(fit(false, 3 / 2, ASPECT.wide), "cover");
  });

  it("letterboxes once the crop starts eating the subject", () => {
    // 4:3 in 16:9 → 25% gone.
    assert.equal(fit(false, ASPECT.classic, ASPECT.wide), "contain");
    // The headline case: a 16:9 camera in a 9:16 phone slot → 68% gone.
    assert.equal(fit(false, ASPECT.wide, ASPECT.portrait), "contain");
    // An ultrawide camera in a 16:9 tile → 24% gone.
    assert.equal(fit(false, ASPECT.ultrawide, ASPECT.wide), "contain");
  });

  it("is symmetric — a portrait source in a wide tile is cropped just as badly", () => {
    assert.equal(fit(false, ASPECT.portrait, ASPECT.wide), "contain");
    assert.equal(
      fit(false, ASPECT.wide, ASPECT.portrait),
      fit(false, ASPECT.portrait, ASPECT.wide)
    );
  });

  it("sits exactly on the documented budget", () => {
    assert.equal(CROP_BUDGET, 1.2);
    // At the budget, fill; a hair over it, letterbox.
    assert.equal(fit(false, CROP_BUDGET, 1), "cover");
    assert.equal(fit(false, CROP_BUDGET + 0.001, 1), "contain");
  });

  it("fills while the geometry is still unknown, so bars never flash in", () => {
    assert.equal(fit(false, null, ASPECT.wide), "cover");
    assert.equal(fit(false, ASPECT.wide, null), "cover");
    assert.equal(fit(false, null, null), "cover");
    // Degenerate measurements are 'unknown', not a divide-by-zero.
    assert.equal(fit(false, 0, ASPECT.wide), "cover");
    assert.equal(fit(false, ASPECT.wide, -1), "cover");
    // …but an unmeasured screen share is still never cropped.
    assert.equal(fit(true, null, null), "contain");
  });

  it("depends on nothing but its three inputs", () => {
    const once = fit(false, ASPECT.classic, ASPECT.portrait);
    for (let i = 0; i < 5; i += 1) {
      assert.equal(fit(false, ASPECT.classic, ASPECT.portrait), once);
    }
  });
});

describe("cropLoss", () => {
  it("reports the fraction of the frame cover would discard", () => {
    assert.equal(cropLoss(ASPECT.wide, ASPECT.wide), 0);
    assert.ok(Math.abs(cropLoss(ASPECT.classic, ASPECT.wide) - 0.25) < 0.001);
    // The mobile case the host most needs warning about.
    assert.ok(cropLoss(ASPECT.wide, ASPECT.portrait) > 0.66);
  });

  it("is zero when nothing has been measured, so no hint is invented", () => {
    assert.equal(cropLoss(null, ASPECT.wide), 0);
    assert.equal(cropLoss(ASPECT.wide, null), 0);
    assert.equal(cropLoss(0, 0), 0);
  });

  it("agrees with chooseFit at the boundary", () => {
    // Anything chooseFit fills has lost at most 1 - 1/CROP_BUDGET of the frame.
    const ceiling = 1 - 1 / CROP_BUDGET;
    for (const source of Object.values(ASPECT)) {
      for (const tile of Object.values(ASPECT)) {
        if (chooseFit({ isScreenShare: false, sourceAspect: source, tileAspect: tile }) === "cover") {
          assert.ok(cropLoss(source, tile) <= ceiling + 1e-9, `${source} in ${tile}`);
        }
      }
    }
  });
});

describe("fit, by construction", () => {
  it("delegates the decision instead of hardcoding object-fit per tile kind", () => {
    // The bug was a policy baked into a className: screens contain, cameras
    // cover, regardless of shape. Both must now come from chooseFit.
    assert.match(stageView, /chooseFit\(\{ isScreenShare: isScreen, sourceAspect, tileAspect \}\)/);
    assert.doesNotMatch(stageView, /isScreen \? "object-contain" : "object-cover"/);
    assert.doesNotMatch(stageView, /object-cover/);
    // Applied to the live element, so a source that changes shape mid-call does
    // not force a detach/re-attach (which black-flashes the tile).
    assert.match(stageView, /video\.style\.objectFit = fit;/);
  });

  it("measures both aspects rather than assuming either", () => {
    assert.match(stageView, /new ResizeObserver/);
    assert.match(stageView, /addEventListener\("loadedmetadata", readAspect\)/);
    // Screen shares renegotiate when the host switches window; cameras flip on
    // rotation. Metadata alone would pin the first shape forever.
    assert.match(stageView, /addEventListener\("resize", readAspect\)/);
  });

  it("letterboxes onto the stage ground, not a lighter panel", () => {
    assert.match(stageView, /fit === "contain" && "bg-\[#0A0A0B\]"/);
  });

  it("tells the host what viewers are actually seeing", () => {
    assert.match(cockpit, /onLocalFit=\{setFits\}/);
    assert.match(cockpit, /function describeFraming/);
    assert.match(cockpit, /letterboxed/);
    assert.match(cockpit, /cropped view/);
  });
});
