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
  inviteAnnouncement,
  inviteBannerVisible,
  inviteView,
  invitesByUser,
  isAnonymousIdentity,
  releaseActionFor,
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
      assert.deepEqual(inviteView({ id: "r1", status, inviteExpiresAt: at(30_000) }, NOW), { state: "none" }, status);
    }
  });

  it("counts down from expiresAt in whole seconds", () => {
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: at(60_000) }, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: 60,
    });
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: at(1_200) }, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: 2,
    });
  });

  it("is expired AT expiresAt, not a tick later", () => {
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: at(0) }, NOW), { state: "expired", requestId: "r1" });
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: at(-5_000) }, NOW), { state: "expired", requestId: "r1" });
  });

  it("keeps an invitation with no readable expiry open, without a countdown", () => {
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: null }, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: null,
    });
    assert.equal(inviteView({ id: "r1", status: "invited", inviteExpiresAt: "soon" }, NOW).state, "open");
  });

  it("formats a countdown as m:ss and never negative", () => {
    assert.equal(formatCountdown(42), "0:42");
    assert.equal(formatCountdown(65), "1:05");
    assert.equal(formatCountdown(0.2), "0:01");
    assert.equal(formatCountdown(-3), "0:00");
  });
});

describe("leaving the room answers what the reader's row is waiting on", () => {
  it("brings a seat or a hand down, and answers an open invitation", () => {
    assert.equal(releaseActionFor("approved"), "leave");
    assert.equal(releaseActionFor("pending"), "leave");
    assert.equal(releaseActionFor("invited"), "reject");
    for (const status of ["denied", "withdrawn", "removed", null, undefined]) {
      assert.equal(releaseActionFor(status), null, String(status));
    }
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
  it("only the router's own 404 is an undeployed route", () => {
    // wsws-monorepo market-square app.ts: the fallback answers
    // fail('NOT_FOUND', 'Route not found').
    assert.equal(routeMissing({ code: "NOT_FOUND", status: 404, message: "Route not found" }), true);
    // A proxy in front with no envelope at all (Express's default page).
    assert.equal(routeMissing({ code: "NOT_FOUND", status: 404, message: "<pre>Cannot POST /v1/market-square/streams/s1/speaker-invites</pre>" }), true);
    assert.equal(routeMissing({ code: "NOT_FOUND", status: 404, details: { resource: "profile" }, message: "Route not found" }), false);
  });

  it("an ENTITY 404 from a write is a per-person answer, never 'not deployed'", () => {
    // NotFoundError carries no details: "Profile not found" (deleted account),
    // "Stream not found" (a private room they can't see), "Speaker request not found".
    for (const message of ["Profile not found", "Stream not found", "Speaker request not found", "Not found"]) {
      assert.equal(routeMissing({ code: "NOT_FOUND", status: 404, message }), false, message);
      assert.equal(inviteErrorOutcome({ code: "NOT_FOUND", message }, "Ada").kind, "message", message);
    }
    assert.equal(routeMissing({ code: "NOT_FOUND", status: 404 }), false);
  });

  it("the pre-invite service refusing the new action or status is also 'not deployed'", () => {
    assert.equal(routeMissing({ code: "VALIDATION_ERROR", details: [{ path: "action", message: "Invalid enum" }] }), true);
    assert.equal(routeMissing({ code: "VALIDATION_ERROR", details: [{ path: ["status"] }] }), true);
    assert.equal(routeMissing({ code: "VALIDATION_ERROR", details: [{ path: "userId" }] }), false);
    assert.equal(routeMissing({ code: "STAGE_FULL" }), false);
    assert.equal(routeMissing(null), false);
  });

  it("maps every contract code to its outcome", () => {
    assert.deepEqual(inviteErrorOutcome({ code: "NOT_FOUND", message: "Route not found" }), { kind: "unavailable" });
    // The host's own ban: they know it, so the control goes for that person.
    assert.equal(inviteErrorOutcome({ code: "SPEAKER_BANNED" }, "Ada").kind, "refused");
    // A block can be the TARGET's, which the host must not learn: the same
    // line as any failure, and nothing about the control changes.
    assert.deepEqual(inviteErrorOutcome({ code: "BLOCKED" }, "Ada"), inviteErrorOutcome({ code: "SOMETHING_ELSE" }, "Ada"));
    assert.deepEqual(inviteErrorOutcome({ code: "BLOCKED" }, "Ada"), { kind: "message", message: "Couldn't send the invitation." });
    for (const code of ["STREAM_NOT_LIVE", "CANNOT_INVITE_SELF", "NOT_IN_ROOM", "ALREADY_SPEAKER", "STAGE_FULL", "RATE_LIMITED", "TOO_MANY_REQUESTS"]) {
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

  it("the host's invite rate limit is TOO_MANY_REQUESTS, with the service's retry time", () => {
    // The service throws TooManyRequestsError (code TOO_MANY_REQUESTS); a
    // bodyless 429 reaches us as RATE_LIMITED (lib/api/envelope.ts). One answer.
    for (const code of ["TOO_MANY_REQUESTS", "RATE_LIMITED"]) {
      assert.deepEqual(inviteErrorOutcome({ code, details: { retryAfterSeconds: 42 } }, "Ada"), {
        kind: "message",
        message: "Too many invitations. Try again in 0:42.",
      });
    }
    assert.notEqual(inviteErrorOutcome({ code: "TOO_MANY_REQUESTS" }).kind, "cooldown");
  });

  it("tells the invitee plainly why an answer did not land", () => {
    assert.equal(answerErrorMessage({ code: "INVITE_NOT_OPEN" }), "That invitation has ended.");
    assert.match(answerErrorMessage({ code: "STAGE_FULL" }) ?? "", /filled up/);
    assert.equal(answerErrorMessage({ code: "NOT_FOUND", message: "Route not found" }), null);
    assert.equal(answerErrorMessage({ code: "NOT_FOUND", message: "Speaker request not found" }), "Couldn't answer the invitation.");
  });
});

describe("where the invitee's banner is drawn", () => {
  const base = { streamId: "s1", hasInvite: true };
  it("the room's own page draws its own banner, so the shell's stays away", () => {
    assert.equal(inviteBannerVisible({ ...base, pathname: "/gist-rooms/s1" }), false);
    assert.equal(inviteBannerVisible({ ...base, pathname: "/square/gist-rooms/s1" }), false);
  });

  it("anywhere else in the Square, with the room minimised, it is drawn", () => {
    for (const pathname of ["/", "/messages", "/gist-rooms/other", "/u/ada"]) {
      assert.equal(inviteBannerVisible({ ...base, pathname }), true, pathname);
    }
  });

  it("no invitation or no room is no banner", () => {
    assert.equal(inviteBannerVisible({ ...base, hasInvite: false, pathname: "/" }), false);
    assert.equal(inviteBannerVisible({ ...base, streamId: null, pathname: "/" }), false);
  });
});

describe("the host's open invitations, keyed on the person", () => {
  it("keys on the bare user id and ignores anything that is not an invitation", () => {
    const map = invitesByUser([
      { id: "r1", userId: "did:privy:ada#speaker", status: "invited", inviteExpiresAt: "x" },
      { id: "r2", userId: "did:privy:tobi", status: "pending", inviteExpiresAt: null },
    ]);
    assert.deepEqual([...map.keys()], ["did:privy:ada"]);
    assert.equal(map.get("did:privy:ada")?.id, "r1");
  });
});

describe("the invitee is told once, by name", () => {
  it("names the host when it can and never promises a seat", () => {
    assert.equal(inviteAnnouncement("Ada"), "Ada invited you to speak.");
    assert.equal(inviteAnnouncement("  "), "The host invited you to speak.");
    assert.doesNotMatch(inviteAnnouncement(null), /seat|mic/i);
  });
});
