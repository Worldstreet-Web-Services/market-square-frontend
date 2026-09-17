import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldAutoEnableMic } from "./mic-consent.ts";
import {
  OUTCOME_GRACE_MS,
  createAnswerLatch,
  answerLanding,
  INVITE_BANNER_RESERVE_PX,
  inviteDockStyle,
  inviteDockTop,
  answerBusyCopy,
  inviteCountdownLabel,
  invitedCountdownLabel,
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
  inviteGateHandle,
  releaseActionFor,
  releaseOnLeave,
  createInflightAnswers,
  routeMissing,
  settleInvites,
  trackInvite,
  cancelFailedForReal,
  inviteSentMessage,
  liveInviteRow,
  type InviteTarget,
} from "./speaker-invite.ts";

const NOW = Date.parse("2026-09-17T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("the invitee's banner reads the server's clock", () => {
  // The contract's row: created at server time NOW, open until NOW + 60s.
  const row = (fields: Partial<{ status: string; inviteExpiresAt: string | null; createdAt: string }> = {}) => ({
    id: "r1",
    status: "invited",
    inviteExpiresAt: at(60_000),
    createdAt: at(0),
    ...fields,
  });

  it("draws nothing for anything but an invitation", () => {
    assert.deepEqual(inviteView(null, NOW), { state: "none" });
    for (const status of ["pending", "approved", "denied", "withdrawn", "removed"]) {
      assert.deepEqual(inviteView(row({ status }), NOW), { state: "none" }, status);
    }
  });

  it("counts down to inviteExpiresAt on the server's clock, in whole seconds", () => {
    assert.deepEqual(inviteView(row(), NOW, NOW, 0), { state: "open", requestId: "r1", secondsLeft: 60 });
    assert.deepEqual(inviteView(row({ inviteExpiresAt: at(1_200) }), NOW, NOW, 0), { state: "open", requestId: "r1", secondsLeft: 2 });
    assert.deepEqual(inviteView(row(), NOW + 30_000, NOW, 0), { state: "open", requestId: "r1", secondsLeft: 30 });
  });

  it("is expired AT its deadline, not a tick later", () => {
    const seen = NOW - 30_000;
    assert.deepEqual(inviteView(row({ inviteExpiresAt: at(0), createdAt: at(-60_000) }), NOW, seen, 0), { state: "expired", requestId: "r1" });
    assert.deepEqual(inviteView(row({ inviteExpiresAt: at(-5_000), createdAt: at(-65_000) }), NOW, seen, 0), { state: "expired", requestId: "r1" });
  });

  it("a device clock running FAST shows the invitation for as long as the server holds it open", () => {
    // Phone 45s ahead. Seen one second after the invite, at server NOW+1s,
    // which the phone reads as NOW+46s. The server still has 59 seconds.
    const offset = -45_000;
    const seenAt = NOW + 46_000;
    assert.deepEqual(inviteView(row(), seenAt, seenAt, offset), { state: "open", requestId: "r1", secondsLeft: 59 });
    assert.equal(inviteView(row(), seenAt + 58_000, seenAt, offset).state, "open");
    assert.equal(inviteView(row(), seenAt + 59_000, seenAt, offset).state, "expired");
  });

  it("a device clock running SLOW ends it at the server's expiry, not past it", () => {
    // Phone 70s behind, and the poll brought the row 8s after it was sent.
    const offset = 70_000;
    const seenAt = NOW + 8_000 - 70_000;
    assert.deepEqual(inviteView(row(), seenAt, seenAt, offset), { state: "open", requestId: "r1", secondsLeft: 52 });
    assert.equal(inviteView(row(), seenAt + 52_000, seenAt, offset).state, "expired");
  });

  it("a row the server still lists but whose expiry has passed on the server's clock is over, not open forever", () => {
    const seenAt = NOW + 70_000;
    assert.deepEqual(inviteView(row(), seenAt, seenAt, 0), { state: "expired", requestId: "r1" });
  });

  it("without a server clock, counts the row's own lifetime from when it was first seen: long, never short", () => {
    // Phone 45s fast, no Date header read yet: the lifetime is both server
    // readings (expiry minus creation), so the device's clock never enters it.
    const seenAt = NOW + 46_000;
    assert.deepEqual(inviteView(row(), seenAt, seenAt), { state: "open", requestId: "r1", secondsLeft: 60 });
    assert.equal(inviteDeadline(at(60_000), seenAt, { createdAt: at(0) }), seenAt + 60_000);
    // A lifetime longer than the contract's is capped at it.
    assert.equal(inviteDeadline(at(130_000), seenAt, { createdAt: at(0) }), seenAt + INVITE_TTL_MS);
  });

  it("with no readable clock at all it is open without a countdown, and still ends after the contract's 60 seconds", () => {
    assert.deepEqual(inviteView(row({ inviteExpiresAt: null }), NOW), { state: "open", requestId: "r1", secondsLeft: null });
    assert.equal(inviteView(row({ inviteExpiresAt: "soon" }), NOW).state, "open");
    assert.deepEqual(inviteView(row({ createdAt: "" }), NOW + 5_000, NOW), { state: "open", requestId: "r1", secondsLeft: null });
    assert.equal(inviteDeadline(at(60_000), NOW, { createdAt: "" }), null);
    assert.deepEqual(inviteView(row({ inviteExpiresAt: null }), NOW + INVITE_TTL_MS, NOW), { state: "expired", requestId: "r1" });
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

describe("the host's block gate always has somebody to look up", () => {
  it("uses the username when the room token carries one", () => {
    assert.equal(inviteGateHandle("ada", "did:privy:ada#speaker"), "ada");
  });

  it("falls back to the account id, without the seat suffix, when it does not", () => {
    assert.equal(inviteGateHandle(null, "did:privy:ada"), "did:privy:ada");
    assert.equal(inviteGateHandle(undefined, "did:privy:ada#speaker"), "did:privy:ada");
    assert.equal(inviteGateHandle("", "did:privy:ada"), "did:privy:ada");
  });

  it("is nothing for an anonymous listener, who cannot be invited and has no profile", () => {
    assert.equal(inviteGateHandle(null, "anon-123"), null);
    assert.equal(inviteGateHandle(null, ""), null);
  });
});

describe("leaving while an answer to the invitation is still on the wire", () => {
  const invited = { id: "r1", status: "invited" };
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it("waits for an accept in flight and sends leave once it seated them, never the stale reject", async () => {
    const answers = createInflightAnswers();
    const accept = deferred<{ id: string; status: string }>();
    answers.track("r1", "accept", accept.promise);
    let cache: { id: string; status: string } | null = invited;
    const sent: string[] = [];
    const done = releaseOnLeave({
      row: invited,
      inflight: answers.current(),
      latest: () => cache,
      send: (id, action) => sent.push(`${id}:${action}`),
    });
    await Promise.resolve();
    assert.deepEqual(sent, [], "nothing is sent while the accept is out");
    cache = { id: "r1", status: "approved" };
    accept.resolve({ id: "r1", status: "approved" });
    await done;
    assert.deepEqual(sent, ["r1:leave"]);
    assert.equal(answers.current(), null, "the slot clears once the answer settles");
  });

  it("an accept that failed while the invitation is still open is answered reject", async () => {
    const answers = createInflightAnswers();
    const accept = deferred<{ id: string; status: string }>();
    answers.track("r1", "accept", accept.promise);
    const sent: string[] = [];
    const done = releaseOnLeave({
      row: invited,
      inflight: answers.current(),
      latest: () => invited,
      send: (id, action) => sent.push(`${id}:${action}`),
    });
    accept.reject(new Error("STAGE_FULL"));
    await done;
    assert.deepEqual(sent, ["r1:reject"]);
  });

  it("an accept that found the invitation already ended releases nothing", async () => {
    const answers = createInflightAnswers();
    const accept = deferred<{ id: string; status: string }>();
    answers.track("r1", "accept", accept.promise);
    const sent: string[] = [];
    const done = releaseOnLeave({
      row: invited,
      inflight: answers.current(),
      latest: () => ({ id: "r1", status: "withdrawn" }),
      send: (id, action) => sent.push(`${id}:${action}`),
    });
    accept.reject(new Error("INVITE_NOT_OPEN"));
    await done;
    assert.deepEqual(sent, []);
  });

  it("a reject already on the wire is the answer: nothing more is sent", async () => {
    const answers = createInflightAnswers();
    answers.track("r1", "reject", new Promise(() => {}));
    const sent: string[] = [];
    await releaseOnLeave({ row: invited, inflight: answers.current(), latest: () => invited, send: (id, action) => sent.push(`${id}:${action}`) });
    assert.deepEqual(sent, []);
  });

  it("with nothing in flight the row decides, and an answer about another row does not hold it up", async () => {
    const sent: string[] = [];
    const send = (id: string, action: string) => sent.push(`${id}:${action}`);
    await releaseOnLeave({ row: invited, inflight: null, latest: () => invited, send });
    await releaseOnLeave({ row: { id: "r2", status: "approved" }, inflight: null, latest: () => null, send });
    const answers = createInflightAnswers();
    answers.track("old", "accept", new Promise(() => {}));
    await releaseOnLeave({ row: { id: "r3", status: "pending" }, inflight: answers.current(), latest: () => null, send });
    await releaseOnLeave({ row: { id: "r4", status: "denied" }, inflight: null, latest: () => null, send });
    assert.deepEqual(sent, ["r1:reject", "r2:leave", "r3:leave"]);
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

  it("is disabled with a reason for somebody who has left the room", () => {
    const control = inviteControl({ ...base, target: { ...listener, present: false } });
    assert.deepEqual(control, { kind: "invite", disabled: true, reason: "They've left the room." });
    // An invitation already out stays cancellable.
    assert.deepEqual(inviteControl({ ...base, target: { ...listener, present: false, openInviteId: "inv-1" } }), { kind: "invited", requestId: "inv-1" });
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
    assert.equal(hostOutcomeLabel("Ada"), "Ada isn't available to speak right now.");
    assert.equal(hostOutcomeLabel(null), "They aren't available to speak right now.");
    assert.doesNotMatch(hostOutcomeLabel("Ada"), /declin|reject|refus/i);
  });

  const open = [{ id: "inv-1", userId: "did:a", name: "Ada", inviteExpiresAt: at(60_000), createdAt: at(0) }];
  const empty = { open: [], seatedUserIds: new Set<string>(), cancelledIds: new Set<string>(), offsetMs: 0 };
  const DEADLINE = NOW + 60_000;
  type Tracked = readonly ReturnType<typeof settleInvites>["tracked"][number][];

  /** The host's room open the whole time: one settle a second, as the hook runs it. */
  const run = (from: number, to: number, listed: (now: number) => boolean, start: Tracked = []) => {
    let tracked = start;
    const told: number[] = [];
    for (let now = from; now <= to; now += 1_000) {
      const step = settleInvites(tracked, { ...empty, open: listed(now) ? open : [], now });
      tracked = step.tracked;
      if (step.unavailable.length) told.push(now);
    }
    return { tracked, told };
  };

  it("starts tracking an open invitation silently, with the server's deadline", () => {
    const result = settleInvites([], { ...empty, open, now: NOW });
    assert.deepEqual(result.unavailable, []);
    assert.equal(result.tracked.length, 1);
    assert.equal(result.tracked[0]?.deadline, DEADLINE);
    assert.equal(result.tracked[0]?.timed, true);
  });

  it("a refusal and a lapse are told at the same instant, however late the poll sees the lapse", () => {
    // Ada taps Not now at +5s: the next read stops listing her.
    const refusal = run(NOW, DEADLINE + 20_000, (now) => now < NOW + 5_000);
    // Ada ignores it: listed until a poll that lands 7s after the server lapsed it.
    const lapse = run(NOW, DEADLINE + 20_000, (now) => now < DEADLINE + 7_000);
    assert.deepEqual(refusal.told, [DEADLINE + OUTCOME_GRACE_MS]);
    assert.deepEqual(lapse.told, [DEADLINE + OUTCOME_GRACE_MS]);
    // The Invited row goes at the deadline in both.
    const midway = run(NOW, NOW + 30_000, (now) => now < NOW + 5_000).tracked;
    assert.deepEqual(visibleInvites(midway, NOW + 30_000).map((item) => item.id), ["inv-1"]);
    assert.deepEqual(visibleInvites(midway, DEADLINE), []);
  });

  it("an invitation already told is not tracked again while a late read still lists it", () => {
    const told = run(NOW, DEADLINE + OUTCOME_GRACE_MS, () => true);
    assert.deepEqual(told.told, [DEADLINE + OUTCOME_GRACE_MS]);
    const again = settleInvites(told.tracked, { ...empty, open, endedIds: new Set(["inv-1"]), now: DEADLINE + OUTCOME_GRACE_MS + 1_000 });
    assert.deepEqual(again, { tracked: [], unavailable: [] });
  });

  it("an invitation with no readable expiry is held for the contract's 60 seconds, without a countdown", () => {
    const [tracked] = settleInvites([], { ...empty, offsetMs: null, open: [{ ...open[0], inviteExpiresAt: null }], now: NOW }).tracked;
    assert.equal(tracked?.deadline, NOW + INVITE_TTL_MS);
    assert.equal(tracked?.timed, false);
  });

  it("says nothing when the invitee took the seat, even if the lists disagree for a moment", () => {
    const state = run(NOW, NOW + 1_000, (now) => now < NOW + 1_000).tracked;
    const seated = settleInvites(state, { ...empty, seatedUserIds: new Set(["did:a"]), now: NOW + 2_000 });
    assert.deepEqual(seated, { tracked: [], unavailable: [] });
  });

  it("says nothing when the host took the invitation back, and stops drawing it at once", () => {
    const state = settleInvites([], { ...empty, open, now: NOW }).tracked;
    assert.deepEqual(settleInvites(state, { ...empty, cancelledIds: new Set(["inv-1"]), now: NOW + 1_000 }), { tracked: [], unavailable: [] });
    assert.deepEqual(settleInvites(state, { ...empty, open, cancelledIds: new Set(["inv-1"]), now: NOW + 1_000 }).tracked, []);
  });

  it("a Cancel that failed is tracked again from the next read, with the server's deadline", () => {
    const cancelled = settleInvites(settleInvites([], { ...empty, open, now: NOW }).tracked, {
      ...empty,
      open,
      cancelledIds: new Set(["inv-1"]),
      now: NOW + 1_000,
    });
    assert.deepEqual(cancelled.tracked, []);
    // The POST failed: the id leaves the cancelled set and the row is still listed.
    const back = settleInvites(cancelled.tracked, { ...empty, open, now: NOW + 2_000 });
    assert.deepEqual(back.tracked.map((item) => [item.id, item.deadline]), [["inv-1", DEADLINE]]);
    assert.equal(cancelFailedForReal({ code: "RATE_LIMITED" }), true);
    assert.equal(cancelFailedForReal({ code: "SERVICE_DOWN" }), true);
    assert.equal(cancelFailedForReal({ code: "INVITE_NOT_OPEN" }), false);
    assert.equal(cancelFailedForReal({ code: "AWAITING_INVITEE" }), false);
  });

  it("an invitation sent is tracked from the invite's own answer, before any list read", () => {
    // The host invites and leaves the room page within the second; Ada declines at +5s.
    const sent = trackInvite([], { ...open[0] }, NOW, { offsetMs: 0 });
    assert.deepEqual(sent.map((item) => [item.id, item.deadline, item.timed]), [["inv-1", DEADLINE, true]]);
    assert.equal(trackInvite(sent, { ...open[0] }, NOW + 3_000, { offsetMs: 0 }), sent, "a repeat answer changes nothing");
    const back = run(NOW + 20_000, DEADLINE + 20_000, () => false, sent);
    assert.equal(back.told.length, 1);
  });

  it("an invitation that ended while the host was away is settled when they come back, after a grace for the lists", () => {
    const remembered = settleInvites([], { ...empty, open, now: NOW }).tracked;
    const back = settleInvites(remembered, { ...empty, now: NOW + 120_000 });
    assert.deepEqual(back.unavailable, []);
    assert.deepEqual(run(NOW + 121_000, NOW + 120_000 + OUTCOME_GRACE_MS, () => false, back.tracked).told, [NOW + 120_000 + OUTCOME_GRACE_MS]);
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

  it("a Not now on an invitation that already ended says nothing; a Join still says it ended", () => {
    assert.equal(answerErrorMessage({ code: "INVITE_NOT_OPEN" }, "reject"), null);
    assert.equal(answerErrorMessage({ code: "AWAITING_INVITEE" }, "reject"), null);
    assert.equal(answerErrorMessage({ code: "INVITE_NOT_OPEN" }, "accept"), "That invitation has ended.");
    assert.equal(answerErrorMessage({ code: "STREAM_NOT_LIVE" }, "reject"), "The gist room isn't live any more.");
  });

  it("the host's invite toasts are whole sentences, like every other line in the flow", () => {
    assert.equal(inviteSentMessage("approved", "Ada"), "Ada already asked, so they're joining the stage.");
    assert.equal(inviteSentMessage("invited", "Ada"), "Invited Ada to speak.");
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
      "Ada invited you to speak. Answer within 1 minute: Join as speaker, or Not now, in the Invitation to speak region."
    );
    assert.equal(
      inviteAnnouncement("  ", 42),
      "The host invited you to speak. Answer within 42 seconds: Join as speaker, or Not now, in the Invitation to speak region."
    );
    assert.equal(inviteAnnouncement("Ada", null), "Ada invited you to speak. Join as speaker, or Not now, in the Invitation to speak region.");
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
    assert.deepEqual(said.slice(1), ["20 seconds left to answer the invitation to speak.", null, "The invitation to speak has ended."]);
  });

  it("warns at least 20 seconds ahead (WCAG 2.2.1), never with 10 left", () => {
    assert.ok(INVITE_WARNING_SECONDS >= 20);
    const said = run([
      { requestId: "r1", secondsLeft: 60 },
      { requestId: "r1", secondsLeft: 21 },
      { requestId: "r1", secondsLeft: 20 },
    ]);
    assert.deepEqual(said.slice(1), [null, "20 seconds left to answer the invitation to speak."]);
  });

  it("never says the answers are at the top of the page: with a sheet open they are not", () => {
    for (const left of [60, 42, null]) assert.doesNotMatch(inviteAnnouncement("Ada", left), /top of the page/);
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

  it("an answer that went through frees the latch once the invitation is gone, so a re-invite on the same row can be answered", () => {
    const latch = createAnswerLatch();
    assert.equal(latch.claim("req-1"), true);
    latch.follow("req-1");
    assert.equal(latch.claim("req-1"), false, "still the same open invitation: one answer");
    // Not now went through: the row is no longer an invitation.
    latch.follow(null);
    // The host invites again and the service reuses the row id.
    latch.follow("req-1");
    assert.equal(latch.claim("req-1"), true, "the new invitation can be answered");
  });
});

describe("the countdowns say what they count, and an answer on the wire says so", () => {
  it("the invitee's banner and the host's row name the time as time left", () => {
    assert.equal(inviteCountdownLabel(42), "Answer in 0:42");
    assert.equal(invitedCountdownLabel(65), "ends in 1:05");
  });

  it("names the answer being sent, on the tapped button and for a screen reader", () => {
    assert.deepEqual(answerBusyCopy("accept"), { label: "Joining…", status: "Joining the stage…" });
    assert.deepEqual(answerBusyCopy("reject"), { label: "Declining…", status: "Sending your answer…" });
  });
});

describe("the banner's answers stay on screen however short the viewport", () => {
  const insets = { top: 0, bottom: 0 };
  it("sits under the room's header when there is room for the whole banner", () => {
    // 844 tall phone: 72 top bar + 180 header.
    assert.equal(inviteDockTop({ offsetPx: 252, viewportPx: 844, ...insets }), 264);
  });

  it("a landscape phone or a zoomed desktop pulls it up, so Join as speaker is never past the bottom", () => {
    const top = inviteDockTop({ offsetPx: 252, viewportPx: 375, ...insets });
    assert.ok(top + INVITE_BANNER_RESERVE_PX <= 375 - 12, `top ${top}`);
    assert.equal(inviteDockTop({ offsetPx: 252, viewportPx: 375, top: 0, bottom: 21 }), 375 - INVITE_BANNER_RESERVE_PX - 21 - 12);
  });

  it("never above the safe area, and the banner scrolls inside itself when even that is too short", () => {
    assert.equal(inviteDockTop({ offsetPx: 252, viewportPx: 120, top: 20, bottom: 0 }), 32);
    const style = inviteDockStyle("var(--ws-topbar-h)");
    assert.match(style.top, /^max\(calc\(env\(safe-area-inset-top, 0px\) \+ 12px\), min\(calc\(var\(--ws-topbar-h\) \+ 12px\), calc\(100dvh - \d+px - env\(safe-area-inset-bottom, 0px\) - 12px\)\)\)$/);
    assert.ok(style.top.includes(`${INVITE_BANNER_RESERVE_PX}px`));
    assert.match(style.maxHeight, /100dvh/);
    assert.equal(style.overflowY, "auto");
  });
});

describe("an answer lands in the room it was sent from", () => {
  it("the row is written under the answered room, whichever room the session is in now", () => {
    assert.deepEqual(answerLanding({ room: "A", currentRoom: "A", action: "accept", status: "approved" }), { room: "A", hint: true });
    assert.deepEqual(answerLanding({ room: "A", currentRoom: "B", action: "accept", status: "approved" }), { room: "A", hint: false });
  });

  it("the seated hint is said only for an accept that seated them in the room they are still in", () => {
    assert.equal(answerLanding({ room: "A", currentRoom: "", action: "accept", status: "approved" }).hint, false, "left meanwhile");
    assert.equal(answerLanding({ room: "A", currentRoom: "A", action: "reject", status: "rejected" }).hint, false);
    assert.equal(answerLanding({ room: "A", currentRoom: "A", action: "accept", status: "withdrawn" }).hint, false);
  });
});

describe("an invitation is only drawn off a row that is still being read", () => {
  const row = { id: "r1", status: "invited" };
  it("is the reader's invited row while the session polls it", () => {
    assert.equal(liveInviteRow(row, { polling: true, isHost: false }), row);
  });

  it("is nothing once the room ended or the retries gave up, whatever the cache still holds", () => {
    assert.equal(liveInviteRow(row, { polling: false, isHost: false }), null);
  });

  it("is nothing for the host, or for any row that is not an invitation", () => {
    assert.equal(liveInviteRow(row, { polling: true, isHost: true }), null);
    assert.equal(liveInviteRow({ ...row, status: "approved" }, { polling: true, isHost: false }), null);
    assert.equal(liveInviteRow(null, { polling: true, isHost: false }), null);
  });
});
