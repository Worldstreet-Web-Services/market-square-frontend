import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canMakeInvite, inviteErrorCopy, inviteState, inviteUrl } from "../features/messages/lib/invites.ts";

describe("house invite links", () => {
  it("builds the link from the token, since the service returns none", () => {
    assert.equal(inviteUrl("https://square.example", "abc_DEF-123"), "https://square.example/join/abc_DEF-123");
  });

  it("offers the link to any member of a public house and only the owner of a private one", () => {
    assert.equal(canMakeInvite({ visibility: "public", isOwner: false }), true);
    assert.equal(canMakeInvite({ visibility: "private", isOwner: true }), true);
    assert.equal(canMakeInvite({ visibility: "private", isOwner: false }), false);
  });

  it("reads the landing page's state from the preview", () => {
    const base = { viewerIsMember: false, canJoin: false, valid: true, reason: null };
    assert.equal(inviteState({ ...base, viewerIsMember: true }, true), "member");
    assert.equal(inviteState({ ...base, valid: false, reason: "expired" }, true), "expired");
    assert.equal(inviteState({ ...base, valid: false, reason: "used_up" }, false), "used_up");
    assert.equal(inviteState({ ...base, canJoin: true }, true), "join");
    assert.equal(inviteState(base, false), "sign-in", "signed out, canJoin is always false: that is a sign-in, not a refusal");
    assert.equal(inviteState(base, true), "refused");
  });

  it("names why an accept was refused", () => {
    assert.equal(inviteErrorCopy({ code: "GONE", details: { reason: "used_up" } }), "This link has been used up. Ask for a new one.");
    assert.equal(inviteErrorCopy({ code: "GONE", details: { reason: "expired" } }), "This link has expired. Ask for a new one.");
    assert.equal(inviteErrorCopy({ code: "NOT_FOUND" }), "This invite link doesn't work anymore. Ask for a new one.");
    assert.equal(inviteErrorCopy({ code: "FORBIDDEN" }), "You can't join this house.");
    assert.equal(inviteErrorCopy({ code: "VALIDATION", message: "This group is full" }), "This house is full.");
    assert.equal(inviteErrorCopy({ code: "RATE_LIMITED" }), null);
    assert.equal(inviteErrorCopy(null), null);
  });
});
