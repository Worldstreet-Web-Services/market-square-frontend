import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roomCodeVisible } from "./room-code.ts";

describe("who sees a gist room's code", () => {
  it("shows it to everyone in a public room", () => {
    assert.equal(roomCodeVisible({ roomCode: "bcdfghjkm", audience: "public" }, false), true);
    assert.equal(roomCodeVisible({ roomCode: "bcdfghjkm", audience: "public" }, true), true);
  });

  it("keeps it with the host in a private room", () => {
    assert.equal(roomCodeVisible({ roomCode: "bcdfghjkm", audience: "private" }, true), true);
    assert.equal(roomCodeVisible({ roomCode: "bcdfghjkm", audience: "private" }, false), false);
  });

  it("shows nothing when the room has no code", () => {
    assert.equal(roomCodeVisible({ roomCode: null, audience: "public" }, true), false);
    assert.equal(roomCodeVisible({ roomCode: "", audience: "public" }, true), false);
  });
});

describe("roomCodeVisible fails closed on an audience it does not know", () => {
  it("keeps the code with the host", () => {
    assert.equal(roomCodeVisible({ roomCode: "bcdfghjkm", audience: "unknown" }, false), false);
    assert.equal(roomCodeVisible({ roomCode: "bcdfghjkm", audience: "unknown" }, true), true);
  });
});
