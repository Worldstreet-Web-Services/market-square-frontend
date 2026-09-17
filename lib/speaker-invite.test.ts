import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldAutoEnableMic } from "./mic-consent.ts";
import {
  OUTCOME_GRACE_MS,
  answerErrorMessage,
  formatCountdown,
  hostOutcomeLabel,
  inviteControl,
  inviteErrorOutcome,
  inviteView,
  isAnonymousIdentity,
  routeMissing,
  settleInvites,
  type InviteTarget,
} from "./speaker-invite.ts";

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("the invitee's banner reads the server's clock", () => {
  it("draws nothing for anything but an invitation", () => {
    assert.deepEqual(inviteView(null, NOW), { state: "none" });
    for (const status of ["pending", "approved", "denied", "withdrawn", "removed"]) {
      assert.deepEqual(inviteView({ id: "r1", status, expiresAt: at(30_000) }, NOW), { state: "none" }, status);
    }
  });

  it("counts down from expiresAt in whole seconds", () => {
    assert.deepEqual(inviteView({ id: "r1", status: "invited", expiresAt: at(60_000) }, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: 60,
    });
    assert.deepEqual(inviteView({ id: "r1", status: "invited", expiresAt: at(1_200) }, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: 2,
    });
  });

  it("is expired AT expiresAt, not a tick later", () => {
    assert.deepEqual(inviteView({ id: "r1", status: "invited", expiresAt: at(0) }, NOW), { state: "expired", requestId: "r1" });
    assert.deepEqual(inviteView({ id: "r1", status: "invited", expiresAt: at(-5_000) }, NOW), { state: "expired", requestId: "r1" });
  });

  it("keeps an invitation with no readable expiry open, without a countdown", () => {
    assert.deepEqual(inviteView({ id: "r1", status: "invited", expiresAt: null }, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: null,
    });
    assert.equal(inviteView({ id: "r1", status: "invited", expiresAt: "soon" }, NOW).state, "open");
  });

  it("formats a countdown as m:ss and never negative", () => {
    assert.equal(formatCountdown(42), "0:42");
    assert.equal(formatCountdown(65), "1:05");
    assert.equal(formatCountdown(0.2), "0:01");
    assert.equal(formatCountdown(-3), "0:00");
  });
});

describe("accepting an invitation never opens the mic", () => {
  it("inviteAccept is not a reason to auto-enable, whatever else is true", () => {
    for (const intent of [true, false]) {
      assert.equal(shouldAutoEnableMic({ approved: true, canPublish: true, intent, reason: "inviteAccept" }), false);
    }
  });
});

const listener: InviteTarget = { identity: "did:privy:abc", seated: false, pendingRequestId: null, openInviteId: null };
const base = {
  viewerIsHost: true,
  isSelf: false,
  target: listener,
  stageFull: false,
  seatCount: 8,
  unavailable: false,
  refused: false,
  cooldownUntil: null,
  now: NOW,
};

describe("the host's invite control", () => {
  it("is offered to a signed-in listener", () => {
    assert.deepEqual(inviteControl(base), { kind: "invite", disabled: false });
  });

  it("is hidden for a non-host, for the host themselves and for somebody already seated", () => {
    assert.deepEqual(inviteControl({ ...base, viewerIsHost: false }), { kind: "hidden" });
    assert.deepEqual(inviteControl({ ...base, isSelf: true }), { kind: "hidden" });
    assert.deepEqual(inviteControl({ ...base, target: { ...listener, identity: "did:privy:abc#speaker", seated: true } }), { kind: "hidden" });
  });

  it("becomes Seat them when the listener already has a hand up — even before invite ships", () => {
    const target = { ...listener, pendingRequestId: "req-1" };
    assert.deepEqual(inviteControl({ ...base, target }), { kind: "seat", requestId: "req-1" });
    assert.deepEqual(inviteControl({ ...base, target, unavailable: true }), { kind: "seat", requestId: "req-1" });
  });

  it("is hidden when the route is not deployed", () => {
    assert.deepEqual(inviteControl({ ...base, unavailable: true }), { kind: "hidden" });
  });

  it("is hidden, not disabled, for somebody banned or who blocked the host", () => {
    assert.deepEqual(inviteControl({ ...base, refused: true }), { kind: "hidden" });
  });

  it("shows an open invitation as Invited, so the host can take it back", () => {
    assert.deepEqual(inviteControl({ ...base, target: { ...listener, openInviteId: "inv-1" } }), { kind: "invited", requestId: "inv-1" });
  });

  it("is disabled with a reason for an anonymous listener", () => {
    const control = inviteControl({ ...base, target: { ...listener, identity: "anon-7f3a" } });
    assert.equal(control.kind, "invite");
    assert.equal(control.kind === "invite" && control.disabled, true);
    assert.match(control.kind === "invite" && control.disabled ? control.reason : "", /without an account/);
  });

  it("is disabled with a reason when every seat is taken", () => {
    const control = inviteControl({ ...base, stageFull: true });
    assert.deepEqual(control, { kind: "invite", disabled: true, reason: "All 8 seats are taken. Move someone down first." });
  });

  it("is disabled with a live countdown during a cooldown, and offered again when it ends", () => {
    assert.deepEqual(inviteControl({ ...base, cooldownUntil: NOW + 42_000 }), {
      kind: "invite",
      disabled: true,
      reason: "You can invite them again in 0:42.",
    });
    assert.deepEqual(inviteControl({ ...base, cooldownUntil: NOW }), { kind: "invite", disabled: false });
  });

  it("knows an anonymous identity by its prefix, suffix or not", () => {
    assert.equal(isAnonymousIdentity("anon-1"), true);
    assert.equal(isAnonymousIdentity("anon-1#speaker"), true);
    assert.equal(isAnonymousIdentity("did:privy:anon-1"), false);
  });
});

describe("the host is never told 'declined'", () => {
  it("says one neutral sentence for every way an invitation ends unanswered", () => {
    assert.equal(hostOutcomeLabel("Ada"), "Ada isn't available to speak right now");
    assert.equal(hostOutcomeLabel(null), "They aren't available to speak right now");
    assert.doesNotMatch(hostOutcomeLabel("Ada"), /declin|reject|refus/i);
  });

  const open = [{ id: "inv-1", userId: "did:a", name: "Ada" }];
  const empty = { open: [], seatedUserIds: new Set<string>(), cancelledIds: new Set<string>() };

  it("starts tracking an open invitation silently", () => {
    const result = settleInvites([], { ...empty, open, now: NOW });
    assert.deepEqual(result.unavailable, []);
    assert.deepEqual(result.tracked, [{ id: "inv-1", userId: "did:a", name: "Ada", goneAt: null }]);
  });

  it("waits out the grace before saying they are not coming (a refusal and a lapse alike)", () => {
    let state = settleInvites([], { ...empty, open, now: NOW }).tracked;
    const vanished = settleInvites(state, { ...empty, now: NOW + 1_000 });
    assert.deepEqual(vanished.unavailable, []);
    state = vanished.tracked;
    assert.deepEqual(settleInvites(state, { ...empty, now: NOW + 1_000 + OUTCOME_GRACE_MS - 1 }).unavailable, []);
    const settled = settleInvites(state, { ...empty, now: NOW + 1_000 + OUTCOME_GRACE_MS });
    assert.deepEqual(settled.unavailable.map((item) => item.name), ["Ada"]);
    assert.deepEqual(settled.tracked, []);
  });

  it("says nothing when the invitee took the seat, even if the lists disagree for a moment", () => {
    const state = settleInvites(settleInvites([], { ...empty, open, now: NOW }).tracked, { ...empty, now: NOW + 500 }).tracked;
    const seated = settleInvites(state, { ...empty, seatedUserIds: new Set(["did:a"]), now: NOW + 60_000 });
    assert.deepEqual(seated, { tracked: [], unavailable: [] });
  });

  it("says nothing when the host took the invitation back", () => {
    const state = settleInvites([], { ...empty, open, now: NOW }).tracked;
    assert.deepEqual(settleInvites(state, { ...empty, cancelledIds: new Set(["inv-1"]), now: NOW + 60_000 }), { tracked: [], unavailable: [] });
  });

  it("an invitation that reappears is open again", () => {
    const gone = settleInvites(settleInvites([], { ...empty, open, now: NOW }).tracked, { ...empty, now: NOW + 100 }).tracked;
    assert.equal(gone[0]?.goneAt, NOW + 100);
    assert.equal(settleInvites(gone, { ...empty, open, now: NOW + 200 }).tracked[0]?.goneAt, null);
  });
});

describe("error answers", () => {
  it("a 404 without a named resource is an undeployed route; with one it is a real answer", () => {
    assert.equal(routeMissing({ code: "NOT_FOUND", status: 404 }), true);
    assert.equal(routeMissing({ code: "NOT_FOUND", status: 404, details: { resource: "profile" } }), false);
  });

  it("the pre-invite service refusing the new action or status is also 'not deployed'", () => {
    assert.equal(routeMissing({ code: "VALIDATION_ERROR", details: [{ path: "action", message: "Invalid enum" }] }), true);
    assert.equal(routeMissing({ code: "VALIDATION_ERROR", details: [{ path: ["status"] }] }), true);
    assert.equal(routeMissing({ code: "VALIDATION_ERROR", details: [{ path: "userId" }] }), false);
    assert.equal(routeMissing({ code: "STAGE_FULL" }), false);
    assert.equal(routeMissing(null), false);
  });

  it("maps every contract code to its outcome", () => {
    assert.deepEqual(inviteErrorOutcome({ code: "NOT_FOUND" }), { kind: "unavailable" });
    assert.equal(inviteErrorOutcome({ code: "SPEAKER_BANNED" }, "Ada").kind, "refused");
    assert.equal(inviteErrorOutcome({ code: "BLOCKED" }, "Ada").kind, "refused");
    assert.doesNotMatch(JSON.stringify(inviteErrorOutcome({ code: "BLOCKED" }, "Ada")), /block/i);
    for (const code of ["STREAM_NOT_LIVE", "CANNOT_INVITE_SELF", "NOT_IN_ROOM", "ALREADY_SPEAKER", "STAGE_FULL", "RATE_LIMITED"]) {
      assert.equal(inviteErrorOutcome({ code }, "Ada").kind, "message", code);
    }
    assert.equal(inviteErrorOutcome({ code: "NOT_FOUND", details: { resource: "profile" } }, "Ada").kind, "message");
  });

  it("a cooldown carries the server's retryAfterSeconds", () => {
    assert.deepEqual(inviteErrorOutcome({ code: "INVITE_COOLDOWN", details: { retryAfterSeconds: 42 } }, "Ada"), {
      kind: "cooldown",
      retryAfterSeconds: 42,
      message: "You can invite Ada again in 0:42.",
    });
    assert.equal(inviteErrorOutcome({ code: "INVITE_COOLDOWN" }).kind, "cooldown");
  });

  it("tells the invitee plainly why an answer did not land", () => {
    assert.equal(answerErrorMessage({ code: "INVITE_NOT_OPEN" }), "That invitation has ended.");
    assert.match(answerErrorMessage({ code: "STAGE_FULL" }) ?? "", /filled up/);
    assert.equal(answerErrorMessage({ code: "NOT_FOUND" }), null);
  });
});
