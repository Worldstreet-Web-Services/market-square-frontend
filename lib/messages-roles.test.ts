import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberActions, viewerRole } from "../features/messages/lib/roles.ts";

describe("house roles", () => {
  const rows = [
    { role: "owner" as const, profile: { id: "o" } },
    { role: "admin" as const, profile: { id: "a" } },
    { role: "member" as const, profile: { id: "m" } },
  ];

  it("reads the reader's role from the roster, and from createdBy only until it loads", () => {
    assert.equal(viewerRole(rows, "a", "o"), "admin");
    // Ownership was handed over: the roster wins over who made the house.
    assert.equal(viewerRole([{ role: "admin", profile: { id: "o" } }], "o", "o"), "admin");
    assert.equal(viewerRole(undefined, "o", "o"), "owner");
    assert.equal(viewerRole(undefined, "m", "o"), null);
    assert.equal(viewerRole(rows, undefined, "o"), null);
    assert.equal(viewerRole(rows, "stranger", "o"), null);
  });

  it("gives the owner every action on members and admins, never on themself", () => {
    assert.deepEqual(memberActions({ viewer: "owner", target: "member", isSelf: false }), {
      makeAdmin: true, removeAdmin: false, makeOwner: true, remove: true,
    });
    assert.deepEqual(memberActions({ viewer: "owner", target: "admin", isSelf: false }), {
      makeAdmin: false, removeAdmin: true, makeOwner: true, remove: true,
    });
    assert.deepEqual(memberActions({ viewer: "owner", target: "owner", isSelf: true }), {
      makeAdmin: false, removeAdmin: false, makeOwner: false, remove: false,
    });
  });

  it("lets an admin remove members only, and a member nothing", () => {
    assert.deepEqual(memberActions({ viewer: "admin", target: "member", isSelf: false }), {
      makeAdmin: false, removeAdmin: false, makeOwner: false, remove: true,
    });
    for (const target of ["admin", "owner"] as const) {
      assert.equal(memberActions({ viewer: "admin", target, isSelf: false }).remove, false);
    }
    assert.deepEqual(memberActions({ viewer: "member", target: "member", isSelf: false }), {
      makeAdmin: false, removeAdmin: false, makeOwner: false, remove: false,
    });
    assert.equal(memberActions({ viewer: null, target: "member", isSelf: false }).remove, false);
  });
});
