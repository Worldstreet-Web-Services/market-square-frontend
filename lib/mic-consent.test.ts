import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  deriveMicOn,
  micControl,
  shouldAutoEnableMic,
  type MicConsentReason,
} from "./mic-consent.ts";

/*
  A MIC IS NEVER OPENED FOR SOMEBODY.

  An approved speaker muted themselves, went to read a DM and came back — and
  the remount opened their mic. These pin the decision that replaced the
  `startedFor` ref, and the wiring that has no pure half.
*/

const yes = { approved: true, canPublish: true, intent: true };

describe("shouldAutoEnableMic", () => {
  it("is false for every reason but the reader's own approved request", () => {
    const never: MicConsentReason[] = ["remount", "reconnect", "reload", "inviteAccept", "unlock"];
    for (const reason of never) {
      assert.equal(shouldAutoEnableMic({ ...yes, reason }), false, reason);
    }
  });

  it("is true only for ownRequestApproved WITH the intent, the approval and the grant", () => {
    assert.equal(shouldAutoEnableMic({ ...yes, reason: "ownRequestApproved" }), true);
    assert.equal(shouldAutoEnableMic({ ...yes, intent: false, reason: "ownRequestApproved" }), false);
    assert.equal(shouldAutoEnableMic({ ...yes, approved: false, reason: "ownRequestApproved" }), false);
    assert.equal(shouldAutoEnableMic({ ...yes, canPublish: false, reason: "ownRequestApproved" }), false);
  });
});

describe("deriveMicOn", () => {
  it("follows the publication, not a local flag", () => {
    assert.equal(deriveMicOn({ isMuted: false }), true);
    assert.equal(deriveMicOn({ isMuted: true }), false);
    assert.equal(deriveMicOn(null), false);
    assert.equal(deriveMicOn(undefined), false);
  });

  it("flips when the server mutes the track under us", () => {
    const publication = { isMuted: false };
    assert.equal(deriveMicOn(publication), true);
    publication.isMuted = true; // a TrackMuted from the server, no local call made
    assert.equal(deriveMicOn(publication), false);
  });
});

describe("micControl", () => {
  const granted = { canPublish: true, microphone: true };

  it("locks the control while the host has hard-muted the speaker", () => {
    assert.deepEqual(micControl({ hostMuted: "hard", permissions: granted, micOn: false }), {
      disabled: true,
      icon: "lock",
      label: "The host turned off your mic",
    });
  });

  it("leaves a soft mute in the speaker's hands", () => {
    const control = micControl({ hostMuted: "soft", permissions: granted, micOn: false });
    assert.equal(control.disabled, false);
    assert.equal(control.icon, "mic-off");
  });

  it("refuses without the mic permission", () => {
    assert.equal(
      micControl({ hostMuted: "none", permissions: { canPublish: true, microphone: false }, micOn: false }).disabled,
      true
    );
    assert.equal(
      micControl({ hostMuted: "none", permissions: { canPublish: false, microphone: true }, micOn: false }).disabled,
      true
    );
  });

  it("names the next action", () => {
    assert.equal(micControl({ hostMuted: "none", permissions: granted, micOn: true }).label, "Mute your mic");
    assert.equal(micControl({ hostMuted: "none", permissions: granted, micOn: false }).label, "Unmute your mic");
  });
});

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("useStage asks the consent rule and nothing else", () => {
  const stage = strip(read("features/streams/hooks/use-stage.ts"));

  it("no longer gates the publish on a component-lifetime ref", () => {
    assert.doesNotMatch(stage, /startedFor/);
  });

  it("enables the mic only behind shouldAutoEnableMic", () => {
    assert.match(stage, /if \(!shouldAutoEnableMic\(/);
    const auto = stage.slice(stage.indexOf("shouldAutoEnableMic({"));
    assert.ok(auto.indexOf("return;") < auto.indexOf("setMicrophoneEnabled(true)"));
  });

  it("derives micOn from the publication and its mute events", () => {
    assert.match(stage, /deriveMicOn\(/);
    for (const event of ["TrackMuted", "TrackUnmuted", "LocalTrackUnpublished"]) {
      assert.match(stage, new RegExp(`RoomEvent\\.${event}`), event);
    }
    assert.doesNotMatch(stage, /setMicOn\(next\)/, "a local flag is written again after the toggle");
  });

  it("refuses the toggle behind a hard mute or a missing mic permission", () => {
    assert.match(stage, /micControl\(\{/);
    assert.match(stage, /if \(control\.disabled\) return;/);
  });
});
