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
