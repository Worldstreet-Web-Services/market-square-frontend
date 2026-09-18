import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deckCandidates } from "./deck-candidates.ts";

const never = () => false;

describe("the deck only asks about people the reader has not answered for", () => {
  const people = [
    { id: "me" },
    { id: "stranger" },
    { id: "followed", isFollowing: true },
    { id: "winked", winkedByMe: true },
    { id: "edgeless", isFollowing: undefined, winkedByMe: undefined },
  ];

  it("drops the reader, the followed and the winked, and keeps the rest", () => {
    assert.deepEqual(
      deckCandidates(people, { viewerId: "me", winkedHere: never, hideFollowed: true }).map((p) => p.id),
      ["stranger", "edgeless"]
    );
  });

  it("keeps somebody the reader follows once they widen the deck to everyone", () => {
    const ids = deckCandidates(people, { viewerId: "me", winkedHere: never, hideFollowed: false }).map((p) => p.id);
    assert.ok(ids.includes("followed"));
    assert.ok(!ids.includes("winked"), "a wink is an answer whichever way the deck is filtered");
  });

  it("drops somebody winked from this browser before any list has refetched", () => {
    const ids = deckCandidates(people, {
      viewerId: "me",
      winkedHere: (id) => id === "stranger",
      hideFollowed: true,
    }).map((p) => p.id);
    assert.deepEqual(ids, ["edgeless"]);
  });

  it("never reads a missing edge as an answer", () => {
    const ids = deckCandidates([{ id: "edgeless" }], { viewerId: "me", winkedHere: never, hideFollowed: true }).map((p) => p.id);
    assert.deepEqual(ids, ["edgeless"]);
  });
});
