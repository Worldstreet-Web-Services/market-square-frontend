import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldAutoEnableMic } from "./mic-consent.ts";
import {
  OUTCOME_GRACE_MS,
  createAnswerLatch,
  answerErrorMessage,
  formatCountdown,
  hostOutcomeLabel,
  inviteControl,
  inviteErrorOutcome,
  inviteAnnouncement,
  inviteBannerVisible,
  INITIAL_INVITE_ANNOUNCER,
  INVITE_TTL_MS,
  INVITE_WARNING_SECONDS,
  stepInviteAnnouncer,
  inviteDeadline,
  inviteView,
  invitesByUser,
  quietResolveError,
  visibleInvites,
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

  it("counts down from inviteExpiresAt in whole seconds", () => {
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
    const row = { id: "r1", status: "invited", inviteExpiresAt: at(60_000) };
    assert.deepEqual(inviteView(row, NOW + 30_000, NOW), { state: "open", requestId: "r1", secondsLeft: 30 });
  });

  it("is expired AT its deadline, not a tick later", () => {
    const seen = NOW - 30_000;
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: at(0) }, NOW, seen), { state: "expired", requestId: "r1" });
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: at(-5_000) }, NOW, seen), { state: "expired", requestId: "r1" });
  });

  it("keeps an invitation with no readable expiry open, without a countdown", () => {
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: null }, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: null,
    });
    assert.equal(inviteView({ id: "r1", status: "invited", inviteExpiresAt: "soon" }, NOW).state, "open");
  });

  it("a device clock running FAST never hides an invitation the server still holds open", () => {
    // Phone 70s ahead: the server's now+60s reads as ten seconds ago. The row
    // is `invited`, so the server had it open when it answered. Shown with no
    // countdown; the poll (withdrawn) or INVITE_NOT_OPEN ends it.
    const serverExpiry = at(-10_000);
    assert.deepEqual(inviteView({ id: "r1", status: "invited", inviteExpiresAt: serverExpiry }, NOW, NOW), {
      state: "open",
      requestId: "r1",
      secondsLeft: null,
    });
    assert.equal(inviteDeadline(serverExpiry, NOW), null);
  });

  it("a device clock running SLOW never counts past the contract's 60 seconds", () => {
    // Phone 70s behind: the server's now+60s reads as 130s away.
    const row = { id: "r1", status: "invited", inviteExpiresAt: at(130_000) };
    assert.deepEqual(inviteView(row, NOW, NOW), { state: "open", requestId: "r1", secondsLeft: 60 });
    assert.deepEqual(inviteView(row, NOW + INVITE_TTL_MS, NOW), { state: "expired", requestId: "r1" });
    assert.equal(INVITE_TTL_MS, 60_000);
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

  const open = [{ id: "inv-1", userId: "did:a", name: "Ada", inviteExpiresAt: at(60_000) }];
  const empty = { open: [], seatedUserIds: new Set<string>(), cancelledIds: new Set<string>() };
  const DEADLINE = NOW + 60_000;

  it("starts tracking an open invitation silently, with the deadline it was first seen with", () => {
    const result = settleInvites([], { ...empty, open, now: NOW });
    assert.deepEqual(result.unavailable, []);
    assert.deepEqual(result.tracked, [{ id: "inv-1", userId: "did:a", name: "Ada", deadline: DEADLINE, timed: true, goneAt: null }]);
  });

  it("a refusal is told at the same moment as a lapse: never before the invitation's own deadline", () => {
    // Ada taps Not now at +5s; the host's read stops listing her at once.
    let state = settleInvites([], { ...empty, open, now: NOW }).tracked;
    state = settleInvites(state, { ...empty, now: NOW + 5_000 }).tracked;
    // The row, its countdown and her card's badge stay as they were.
    assert.deepEqual(visibleInvites(state, NOW + 30_000).map((item) => item.id), ["inv-1"]);
    assert.deepEqual(settleInvites(state, { ...empty, now: NOW + 5_000 + OUTCOME_GRACE_MS }).unavailable, []);
    assert.deepEqual(settleInvites(state, { ...empty, now: DEADLINE + OUTCOME_GRACE_MS - 1 }).unavailable, []);
    const refused = settleInvites(state, { ...empty, now: DEADLINE + OUTCOME_GRACE_MS });
    assert.deepEqual(refused.unavailable.map((item) => item.name), ["Ada"]);
    assert.deepEqual(refused.tracked, []);

    // The same invitation ignored: listed until the server lapses it.
    let lapse = settleInvites([], { ...empty, open, now: NOW }).tracked;
    lapse = settleInvites(lapse, { ...empty, open, now: DEADLINE - 1 }).tracked;
    assert.deepEqual(visibleInvites(lapse, DEADLINE).map((item) => item.id), []);
    lapse = settleInvites(lapse, { ...empty, now: DEADLINE }).tracked;
    assert.deepEqual(settleInvites(lapse, { ...empty, now: DEADLINE + OUTCOME_GRACE_MS - 1 }).unavailable, []);
    assert.deepEqual(settleInvites(lapse, { ...empty, now: DEADLINE + OUTCOME_GRACE_MS }).unavailable.map((item) => item.name), ["Ada"]);
  });

  it("an invitation with no readable expiry is held for the contract's 60 seconds, without a countdown", () => {
    const [tracked] = settleInvites([], { ...empty, open: [{ ...open[0], inviteExpiresAt: null }], now: NOW }).tracked;
    assert.equal(tracked?.deadline, NOW + INVITE_TTL_MS);
    assert.equal(tracked?.timed, false);
  });

  it("says nothing when the invitee took the seat, even if the lists disagree for a moment", () => {
    const state = settleInvites(settleInvites([], { ...empty, open, now: NOW }).tracked, { ...empty, now: NOW + 500 }).tracked;
    const seated = settleInvites(state, { ...empty, seatedUserIds: new Set(["did:a"]), now: NOW + 60_000 });
    assert.deepEqual(seated, { tracked: [], unavailable: [] });
  });

  it("says nothing when the host took the invitation back, and stops drawing it at once", () => {
    const state = settleInvites([], { ...empty, open, now: NOW }).tracked;
    assert.deepEqual(settleInvites(state, { ...empty, cancelledIds: new Set(["inv-1"]), now: NOW + 1_000 }), { tracked: [], unavailable: [] });
    assert.deepEqual(settleInvites(state, { ...empty, open, cancelledIds: new Set(["inv-1"]), now: NOW + 1_000 }).tracked, []);
  });

  it("an invitation that reappears is open again", () => {
    const gone = settleInvites(settleInvites([], { ...empty, open, now: NOW }).tracked, { ...empty, now: NOW + 100 }).tracked;
    assert.equal(gone[0]?.goneAt, NOW + 100);
    assert.equal(settleInvites(gone, { ...empty, open, now: NOW + 200 }).tracked[0]?.goneAt, null);
  });

  it("an invitation that ended while the host was away from the room is settled when they come back", () => {
    // The tracked list outlives the room page; the next read no longer lists Ben.
    const remembered = settleInvites([], { ...empty, open, now: NOW }).tracked;
    const back = settleInvites(remembered, { ...empty, now: NOW + 120_000 });
    assert.deepEqual(back.unavailable, []);
    assert.deepEqual(settleInvites(back.tracked, { ...empty, now: NOW + 120_000 + OUTCOME_GRACE_MS }).unavailable.map((item) => item.name), ["Ada"]);
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
    assert.deepEqual(inviteErrorOutcome({ code: "NOT_FOUND", message: "Route not found" }), {
      kind: "unavailable",
      message: "Invite to speak isn't available yet.",
    });
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

describe("an invitation that already ended is not an error to the person closing it", () => {
  it("a Cancel or a leave-time Not now that lost the race to the invitee or the clock says nothing", () => {
    for (const action of ["cancel", "reject"]) {
      assert.equal(quietResolveError({ code: "INVITE_NOT_OPEN" }, action), true, action);
      assert.equal(quietResolveError({ code: "AWAITING_INVITEE" }, action), true, action);
    }
    assert.equal(quietResolveError({ code: "AWAITING_INVITEE" }, "leave"), true);
  });

  it("everything else is still said", () => {
    assert.equal(quietResolveError({ code: "INVITE_NOT_OPEN" }, "approve"), false);
    assert.equal(quietResolveError({ code: "STAGE_FULL" }, "cancel"), false);
    assert.equal(quietResolveError({ code: "FORBIDDEN" }, "reject"), false);
    assert.equal(quietResolveError(null, "cancel"), false);
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

describe("the invitee is told once, by name, with the deadline", () => {
  it("names the host, says how long and where the answer is, and never promises a seat", () => {
    assert.equal(
      inviteAnnouncement("Ada", 60),
      "Ada invited you to speak. Answer within 1 minute: Join as speaker, or Not now, at the top of the page."
    );
    assert.equal(
      inviteAnnouncement("  ", 42),
      "The host invited you to speak. Answer within 42 seconds: Join as speaker, or Not now, at the top of the page."
    );
    assert.equal(inviteAnnouncement("Ada", null), "Ada invited you to speak. Join as speaker, or Not now, at the top of the page.");
    assert.doesNotMatch(inviteAnnouncement(null, 60), /seat|mic/i);
  });

  const run = (readings: { requestId: string | null; secondsLeft: number | null; answered?: boolean }[]) => {
    let state = INITIAL_INVITE_ANNOUNCER;
    const said: (string | null)[] = [];
    for (const reading of readings) {
      const step = stepInviteAnnouncer(state, { hostName: "Ada", answered: false, ...reading });
      state = step.state;
      said.push(step.say);
    }
    return said;
  };

  it("announces an invitation once, however often the surfaces around it change", () => {
    const said = run([
      { requestId: "r1", secondsLeft: 60 },
      { requestId: "r1", secondsLeft: 59 },
      { requestId: "r1", secondsLeft: 40 },
    ]);
    assert.match(said[0] ?? "", /^Ada invited you to speak\./);
    assert.deepEqual(said.slice(1), [null, null]);
  });

  it("warns once near the end, and says so when it runs out unanswered", () => {
    const said = run([
      { requestId: "r1", secondsLeft: 60 },
      { requestId: "r1", secondsLeft: INVITE_WARNING_SECONDS },
      { requestId: "r1", secondsLeft: 9 },
      { requestId: null, secondsLeft: null },
    ]);
    assert.deepEqual(said.slice(1), ["10 seconds left to answer the invitation to speak.", null, "The invitation to speak has ended."]);
  });

  it("says nothing more once the reader has answered", () => {
    const said = run([
      { requestId: "r1", secondsLeft: 60 },
      { requestId: "r1", secondsLeft: 20, answered: true },
      { requestId: "r1", secondsLeft: 5, answered: true },
      { requestId: null, secondsLeft: null, answered: true },
    ]);
    assert.deepEqual(said.slice(1), [null, null, null]);
  });
});

describe("one answer per invitation", () => {
  it("a same-frame double tap sends one answer, whichever button it lands on", () => {
    const latch = createAnswerLatch();
    const sent: string[] = [];
    const answer = (id: string, action: string) => {
      if (latch.claim(id)) sent.push(`${id}:${action}`);
    };
    answer("req-1", "accept");
    answer("req-1", "accept");
    answer("req-1", "reject");
    assert.deepEqual(sent, ["req-1:accept"]);
  });

  it("a failed answer can be retried, and a new invitation claims afresh", () => {
    const latch = createAnswerLatch();
    assert.equal(latch.claim("req-1"), true);
    latch.release("req-2");
    assert.equal(latch.claim("req-1"), false, "releasing another invitation frees nothing");
    latch.release("req-1");
    assert.equal(latch.claim("req-1"), true, "retry after a failure");
    assert.equal(latch.claim("req-2"), true, "a new invitation");
  });
});
