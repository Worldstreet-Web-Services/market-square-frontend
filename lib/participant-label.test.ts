import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: node --test resolves neither the "@/" alias
// nor an extensionless specifier.
import { participantLabel } from "../features/streams/lib/stage.ts";

describe("participantLabel", () => {
  it("uses the name LiveKit carries", () => {
    assert.equal(participantLabel("ogazboiz", "did:privy:cmtad9ojl00m80dl2lkl4erib"), "ogazboiz");
  });

  // A guest speaker was captioned did:privy:cmtad9ojl00m80dl2lkl4erib on the
  // stage: unreadable, and it published an account id to every viewer.
  it("never captions a tile with a raw account id", () => {
    const label = participantLabel(undefined, "did:privy:cmtad9ojl00m80dl2lkl4erib");
    assert.ok(!label.includes("did:privy"), `leaked the identity: ${label}`);
    assert.equal(label, "Guest ERIB");
  });

  it("ignores the speaker suffix, so one guest is not two labels", () => {
    assert.equal(
      participantLabel(undefined, "did:privy:abcd1234#speaker"),
      participantLabel(undefined, "did:privy:abcd1234")
    );
  });

  it("treats a blank name as no name", () => {
    assert.equal(participantLabel("   ", "did:privy:abcd1234"), "Guest 1234");
  });
});
