import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { atHandle } from "./handle.ts";

describe("the @handle shown beside a name", () => {
  it("shows a real username", () => {
    assert.equal(atHandle("ogazboiz"), "@ogazboiz");
  });

  it("shows NOTHING for a profile id", () => {
    // The schema falls back to the id so LINKS keep resolving. Printing it is
    // forty characters of internal id dressed up as something typeable.
    assert.equal(atHandle("did:privy:cmtzq9iox006g0clc4n96gt4t"), null);
    // Any DID method, not just Privy's — the prefix is the family.
    assert.equal(atHandle("did:key:z6Mk"), null);
    // Nor a Decane user id, since the move off Privy.
    assert.equal(atHandle("3f0c9a1e-6b2d-4c1a-9e7f-0a1b2c3d4e5f"), null);
  });

  it("shows nothing when there is nothing", () => {
    assert.equal(atHandle(null), null);
    assert.equal(atHandle(undefined), null);
    assert.equal(atHandle(""), null);
  });

  it("does not invent a handle", () => {
    // Anything made up here would be untypeable and would 404 on /u/<it>.
    // Only the service can mint a handle it will answer to.
    const made = atHandle("did:privy:abcdef");
    assert.equal(made, null);
  });
});

describe("the minted handle the service hands out", () => {
  it("prints like any other handle", () => {
    // `user_` + eight of the room-code alphabet. It is a real address —
    // /profiles/user_kmvvbmrf resolves — so there is nothing to special-case.
    assert.equal(atHandle("user_kmvvbmrf"), "@user_kmvvbmrf");
  });
});
