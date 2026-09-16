import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { profileHref } from "./profile-href.ts";

describe("a link to a person goes by what cannot change", () => {
  it("uses the profile id, not the username", () => {
    assert.equal(
      profileHref({ id: "did:privy:cmsdjd223002q0ckw2tnwsxkd", username: "ogazboiz" }),
      "/square/u/did:privy:cmsdjd223002q0ckw2tnwsxkd"
    );
  });

  it("reaches a person's sub-pages the same way", () => {
    assert.equal(profileHref({ id: "did:privy:abc", username: "amara" }, "following"), "/square/u/did:privy:abc/following");
    assert.equal(profileHref({ id: "did:privy:abc" }, "settings"), "/square/u/did:privy:abc/settings");
  });

  it("never builds a path from an id that is not a safe segment", () => {
    assert.equal(profileHref({ id: "../../admin", username: "amara" }), "/square/u/amara");
    assert.equal(profileHref({ id: "a/b", username: "amara" }), "/square/u/amara");
    assert.equal(profileHref({ id: "" , username: "amara" }), "/square/u/amara");
  });
});
