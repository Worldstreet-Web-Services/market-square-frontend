import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProfileSchema } from "./schemas.ts";

// A minimal ProfileSummary as the service hydrates it.
const base = {
  id: "did:privy:abc123",
  username: "amara",
  displayName: "Amara Okafor",
  role: "creator",
  verification: "earned",
};

describe("ProfileSchema.orgBadge", () => {
  it("carries a market badge through", () => {
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: "market" }).orgBadge, "market");
  });

  it("carries an ark badge through", () => {
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: "ark" }).orgBadge, "ark");
  });

  it("defaults to null when the backend omits the field entirely", () => {
    // The badge shipped after this client did; an older payload must still
    // parse rather than throwing and blanking the whole surface.
    assert.equal(ProfileSchema.parse(base).orgBadge, null);
  });

  it("keeps an explicit null as null", () => {
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: null }).orgBadge, null);
  });

  it("coerces an unknown badge to null rather than throwing", () => {
    // A future third badge must not break every profile that carries it —
    // rendering no chip is the safe degradation.
    assert.equal(ProfileSchema.parse({ ...base, orgBadge: "partner" }).orgBadge, null);
  });

  it("is independent of role — worldstreet does not imply a badge", () => {
    // The badge is assigned admin-only; deriving it from role would invent one.
    const parsed = ProfileSchema.parse({ ...base, role: "worldstreet" });
    assert.equal(parsed.role, "worldstreet");
    assert.equal(parsed.orgBadge, null);
  });

  it("co-exists with role, which stays untouched", () => {
    const parsed = ProfileSchema.parse({ ...base, role: "citizen", orgBadge: "ark" });
    assert.equal(parsed.role, "citizen");
    assert.equal(parsed.orgBadge, "ark");
  });
});

describe("ProfileSchema.verification", () => {
  const states = ["none", "pending", "verified", "lapsed"] as const;

  for (const state of states) {
    it(`carries "${state}" through`, () => {
      assert.equal(ProfileSchema.parse({ ...base, verification: state }).verification, state);
    });
  }

  it("coerces the retired 'earned' tier to none rather than throwing", () => {
    // The old enum was none|pending|earned|paid. A stale payload must degrade
    // to "no check" — never to a check the account no longer holds.
    assert.equal(ProfileSchema.parse({ ...base, verification: "earned" }).verification, "none");
  });

  it("coerces the retired 'paid' tier to none", () => {
    assert.equal(ProfileSchema.parse({ ...base, verification: "paid" }).verification, "none");
  });

  it("coerces an unknown state to none", () => {
    assert.equal(ProfileSchema.parse({ ...base, verification: "banned" }).verification, "none");
  });

  it("never carries billing fields on a public profile", () => {
    // Billing lives only on /me/verification. Even if a backend leaked these,
    // the profile schema must not surface them to other users' views.
    const parsed = ProfileSchema.parse({
      ...base,
      verification: "verified",
      paidThrough: "2026-01-01T00:00:00Z",
      daysRemaining: 9,
    }) as Record<string, unknown>;
    assert.equal(parsed.paidThrough, undefined);
    assert.equal(parsed.daysRemaining, undefined);
  });
});
