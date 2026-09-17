import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inviteMemoryFor, rememberBan, rememberEndedInvite } from "../features/streams/lib/invite-memory.ts";
import { INVITE_COOLDOWN_MS, inviteControl, type TrackedInvite } from "./speaker-invite.ts";

const NOW = Date.parse("2026-09-17T12:00:00.000Z");

const control = (memory: ReturnType<typeof inviteMemoryFor>, userId: string, now: number) =>
  inviteControl({
    viewerIsHost: true,
    isSelf: false,
    target: { identity: userId, seated: false, pendingRequestId: null, openInviteId: null },
    stageFull: false,
    seatCount: 8,
    unavailable: false,
    refused: memory.refused.has(userId),
    cooldownUntil: memory.cooldowns.get(userId) ?? null,
    now,
  });

const ended = (userId: string, deadline: number): TrackedInvite => ({
  id: `inv-${userId}`,
  userId,
  name: "Ben",
  deadline,
  timed: true,
  checkedAt: deadline,
  resumedAt: deadline,
});

describe("what the host's invite control knows about a person, before any tap", () => {
  it("a person the host banned from chat is not offered Invite to speak", () => {
    const memory = inviteMemoryFor("ban-room");
    assert.equal(control(memory, "did:privy:ben", NOW).kind, "invite");
    rememberBan(memory, "did:privy:ben#speaker");
    assert.deepEqual(control(memory, "did:privy:ben", NOW), { kind: "hidden" }, "hidden, keyed on the bare id");
  });

  it("an invitation that ended starts the cooldown the service starts, the same for a refusal and a lapse", () => {
    const deadline = NOW + 60_000;
    const refused = inviteMemoryFor("cooldown-refused");
    const lapsed = inviteMemoryFor("cooldown-lapsed");
    rememberEndedInvite(refused, ended("did:privy:ben", deadline));
    rememberEndedInvite(lapsed, ended("did:privy:ben", deadline));
    assert.equal(refused.cooldowns.get("did:privy:ben"), deadline + INVITE_COOLDOWN_MS);
    assert.deepEqual(refused.cooldowns, lapsed.cooldowns);
    const told = deadline + 6_000;
    assert.deepEqual(control(refused, "did:privy:ben", told), {
      kind: "invite",
      disabled: true,
      reason: "You can invite them again in 2:54.",
    });
    assert.deepEqual(control(refused, "did:privy:ben", deadline + INVITE_COOLDOWN_MS), { kind: "invite", disabled: false });
  });

  it("a longer cooldown the service already named is kept", () => {
    const memory = inviteMemoryFor("cooldown-server");
    const serverSaid = NOW + 60_000 + INVITE_COOLDOWN_MS + 30_000;
    memory.cooldowns.set("did:privy:ben", serverSaid);
    rememberEndedInvite(memory, ended("did:privy:ben", NOW + 60_000));
    assert.equal(memory.cooldowns.get("did:privy:ben"), serverSaid);
  });
});
