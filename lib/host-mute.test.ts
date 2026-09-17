import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOST_MUTE_LABEL,
  HOST_MUTE_TOAST,
  INITIAL_HOST_MUTE_TOAST,
  hostMuteControl,
  hostMuteOf,
  MUTE_UNAVAILABLE,
  muteErrorMessage,
  muteFailure,
  mutedByHost,
  stepHostMuteBadges,
  stepHostMuteToast,
  type HostMuteToastState,
} from "./host-mute.ts";

describe("the Muted by host badge", () => {
  it("reads the attribute, and only 'soft' is a host mute", () => {
    assert.equal(hostMuteOf({ hostMuted: "soft" }), "soft");
    assert.equal(hostMuteOf({ hostMuted: "" }), "none");
    assert.equal(hostMuteOf({ hostMuted: "none" }), "none");
    assert.equal(hostMuteOf({}), "none");
    assert.equal(hostMuteOf(null), "none");
  });

  it("shows while the attribute is set AND the mic is muted", () => {
    assert.equal(mutedByHost({ hostMuted: "soft" }, true), true);
  });

  it("goes away when the speaker unmutes themselves, though the attribute stays", () => {
    assert.equal(mutedByHost({ hostMuted: "soft" }, false), false);
  });

  it("is never drawn for a speaker who muted themselves", () => {
    assert.equal(mutedByHost({}, true), false);
  });
});

describe("the badge remembers whether the speaker has unmuted since the host's mute", () => {
  type Seat = { identity: string; token: string; published: boolean; micMuted: boolean };
  const seat = (token: string, micMuted: boolean, published = true): Seat => ({ identity: "did:ben#speaker", token, published, micMuted });
  const play = (readings: Seat[][]) => {
    let memory = new Map();
    const out: boolean[] = [];
    for (const seats of readings) {
      const step = stepHostMuteBadges(memory, seats);
      memory = step.memory;
      out.push(step.badges.get("did:ben#speaker") ?? false);
    }
    return out;
  };

  it("host mutes, speaker unmutes and talks, then mutes themselves: no badge on their own choice", () => {
    assert.deepEqual(
      play([[seat("", false)], [seat("soft", false)], [seat("soft", true)], [seat("soft", false)], [seat("soft", true)]]),
      [false, false, true, false, false]
    );
  });

  it("a new host mute (a new attribute value) shows the badge again", () => {
    assert.deepEqual(
      play([[seat("soft:1", true)], [seat("soft:1", false)], [seat("soft:2", false)], [seat("soft:2", true)]]),
      [true, false, false, true]
    );
  });

  it("moved down and seated again with the mic unpublished: no badge before they have done anything", () => {
    assert.deepEqual(play([[seat("soft", true)], [], [seat("soft", true, false)]]), [true, false, false]);
  });

  it("the attribute cleared is no badge, and forgets the seat", () => {
    const first = stepHostMuteBadges(new Map(), [seat("soft", true)]);
    const cleared = stepHostMuteBadges(first.memory, [seat("", true)]);
    assert.equal(cleared.badges.get("did:ben#speaker"), false);
    assert.equal(cleared.memory.size, 0);
  });

  it("reads a per-mute attribute value as a host mute", () => {
    assert.equal(hostMuteOf({ hostMuted: "soft:1726570000000" }), "soft");
    assert.equal(hostMuteOf({ hostMuted: "softly" }), "none");
  });
});

const seatedGuest = {
  viewerIsHost: true,
  seated: true,
  targetIsHost: false,
  isSelf: false,
  micMuted: false,
  unavailable: false,
};

describe("the host's Mute for everyone", () => {
  it("is offered on a seated guest whose mic is on", () => {
    assert.deepEqual(hostMuteControl(seatedGuest), { kind: "mute", disabled: false, label: HOST_MUTE_LABEL });
    assert.equal(HOST_MUTE_LABEL, "Mute for everyone");
  });

  it("nobody can mute the host — not even the host", () => {
    assert.deepEqual(hostMuteControl({ ...seatedGuest, targetIsHost: true }), { kind: "hidden" });
    assert.deepEqual(hostMuteControl({ ...seatedGuest, isSelf: true }), { kind: "hidden" });
  });

  it("is hidden from anyone but the host, over the audience, and while the route is not deployed", () => {
    assert.deepEqual(hostMuteControl({ ...seatedGuest, viewerIsHost: false }), { kind: "hidden" });
    assert.deepEqual(hostMuteControl({ ...seatedGuest, seated: false }), { kind: "hidden" });
    assert.deepEqual(hostMuteControl({ ...seatedGuest, unavailable: true }), { kind: "hidden" });
  });

  it("is disabled with a reason when their mic is already off", () => {
    assert.deepEqual(hostMuteControl({ ...seatedGuest, micMuted: true }), {
      kind: "mute",
      disabled: true,
      label: HOST_MUTE_LABEL,
      reason: "Their mic is already off.",
    });
  });

  it("offers no lock and no unmute, anywhere", () => {
    const labels = JSON.stringify([hostMuteControl(seatedGuest), hostMuteControl({ ...seatedGuest, micMuted: true })]);
    assert.doesNotMatch(labels, /lock|unmute/i);
  });
});

const NOW = 1_000_000;
type Reading = { current: "none" | "soft"; micOn: boolean; signalled?: boolean; at?: number };
const run = (readings: Reading[], from: HostMuteToastState = INITIAL_HOST_MUTE_TOAST) => {
  let state = from;
  const toasts: number[] = [];
  readings.forEach((reading, index) => {
    const step = stepHostMuteToast(state, {
      current: reading.current,
      micOn: reading.micOn,
      signalled: reading.signalled ?? false,
      now: reading.at ?? NOW + index * 10,
    });
    state = step.state;
    if (step.toast) toasts.push(index);
  });
  return { state, toasts };
};

describe("the muted speaker is told once", () => {
  it("toasts when the attribute turns to soft and the mic is off", () => {
    assert.deepEqual(run([{ current: "none", micOn: true }, { current: "soft", micOn: false }]).toasts, [1]);
    assert.equal(HOST_MUTE_TOAST, "The host muted your mic. You can unmute when it's your turn.");
  });

  it("the first reading on a connection is the room as found, not news — a reconnect replay included", () => {
    assert.deepEqual(run([{ current: "soft", micOn: false }]).toasts, []);
    assert.deepEqual(run([{ current: "soft", micOn: false }, { current: "soft", micOn: false }]).toasts, []);
  });

  it("an attribute that lands before the track mute still toasts, once the mic is off", () => {
    assert.deepEqual(
      run([{ current: "none", micOn: true }, { current: "soft", micOn: true }, { current: "soft", micOn: false }]).toasts,
      [2]
    );
  });

  it("the push is a signal to look: it toasts only once the attribute and the mic agree", () => {
    assert.deepEqual(run([{ current: "none", micOn: true }, { current: "none", micOn: true, signalled: true }]).toasts, []);
    assert.deepEqual(
      run([{ current: "none", micOn: true }, { current: "none", micOn: true, signalled: true }, { current: "soft", micOn: false }]).toasts,
      [2]
    );
  });

  it("a second mute, after the speaker unmuted themselves, is noticed through the push", () => {
    const first = run([{ current: "none", micOn: true }, { current: "soft", micOn: false }]);
    const second = run(
      [
        { current: "soft", micOn: true, at: NOW + 60_000 },
        { current: "soft", micOn: false, signalled: true, at: NOW + 61_000 },
      ],
      first.state
    );
    assert.deepEqual(second.toasts, [1]);
  });

  it("a second mute is noticed WITHOUT the push when the service writes a new value per mute", () => {
    let state = INITIAL_HOST_MUTE_TOAST;
    const readings: { token: string; micOn: boolean; at: number }[] = [
      { token: "", micOn: true, at: NOW },
      { token: "soft:1", micOn: false, at: NOW + 1_000 },
      { token: "soft:1", micOn: true, at: NOW + 60_000 },
      { token: "soft:2", micOn: false, at: NOW + 90_000 },
    ];
    const toasts: number[] = [];
    readings.forEach((reading, index) => {
      const current = reading.token ? "soft" : "none";
      const step = stepHostMuteToast(state, { current, token: reading.token, micOn: reading.micOn, signalled: false, now: reading.at });
      state = step.state;
      if (step.toast) toasts.push(index);
    });
    assert.deepEqual(toasts, [1, 3]);
  });

  it("the attribute and the push for one mute make one toast", () => {
    const { toasts } = run([
      { current: "none", micOn: true },
      { current: "soft", micOn: false },
      { current: "soft", micOn: false, signalled: true },
    ]);
    assert.deepEqual(toasts, [1]);
  });

  it("never toasts about a mic that is on, or a mute already lifted", () => {
    assert.deepEqual(run([{ current: "none", micOn: true }, { current: "soft", micOn: true }]).toasts, []);
    assert.deepEqual(
      run([{ current: "none", micOn: true }, { current: "soft", micOn: true }, { current: "none", micOn: false }]).toasts,
      []
    );
  });
});

describe("mute errors", () => {
  it("an undeployed mute route hides the control AND tells the host, never a silent no-op", () => {
    assert.deepEqual(muteFailure({ missing: true, error: { code: "NOT_FOUND" }, name: "Ada" }), {
      unavailable: true,
      message: "Mute for everyone isn't available yet.",
    });
    assert.equal(MUTE_UNAVAILABLE, "Mute for everyone isn't available yet.");
    assert.deepEqual(muteFailure({ missing: false, error: { code: "NOT_A_SPEAKER" }, name: "Ada" }), {
      unavailable: false,
      message: "Ada is not on the stage any more.",
    });
  });

  it("names the problem without blaming anybody", () => {
    assert.equal(muteErrorMessage({ code: "STREAM_NOT_LIVE" }), "The gist room isn't live.");
    assert.equal(muteErrorMessage({ code: "NOT_A_SPEAKER" }, "Ada"), "Ada is not on the stage any more.");
    assert.equal(muteErrorMessage({ code: "BAD_RESPONSE" }, "Ada"), "Couldn't mute Ada.");
    assert.equal(muteErrorMessage(null), "Couldn't mute them.");
    for (const code of ["TOO_MANY_REQUESTS", "RATE_LIMITED"]) {
      assert.equal(muteErrorMessage({ code }), "Too many mutes at once. Try again in a moment.", code);
    }
  });
});
