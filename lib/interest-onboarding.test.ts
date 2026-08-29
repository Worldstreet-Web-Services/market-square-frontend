import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { askedKeyFor, shouldAskInterests } from "./interest-onboarding.ts";

const newUser = {
  authenticated: true,
  usernameUnclaimed: false,
  savedTopics: [] as string[] | undefined,
  availableTopics: 7,
  alreadyAsked: false,
};

describe("shouldAskInterests", () => {
  it("asks a signed-in reader who has chosen nothing", () => {
    assert.equal(shouldAskInterests(newUser), true);
  });

  it("never asks a signed-out reader", () => {
    assert.equal(shouldAskInterests({ ...newUser, authenticated: false }), false);
  });

  // Two modal prompts stacked on a first visit is not an onboarding.
  it("waits for the username claim to be out of the way", () => {
    assert.equal(shouldAskInterests({ ...newUser, usernameUnclaimed: true }), false);
  });

  it("does not ask someone who already chose", () => {
    assert.equal(shouldAskInterests({ ...newUser, savedTopics: ["gaming"] }), false);
  });

  // The difference that matters: "still loading" and "not deployed" both read
  // as undefined, and neither means the reader picked nothing.
  it("says nothing while the answer is unknown", () => {
    assert.equal(shouldAskInterests({ ...newUser, savedTopics: undefined }), false);
  });

  it("does not open an empty picker", () => {
    assert.equal(shouldAskInterests({ ...newUser, availableTopics: 0 }), false);
  });

  it("respects a reader who has already been asked", () => {
    assert.equal(shouldAskInterests({ ...newUser, alreadyAsked: true }), false);
  });
});

describe("askedKeyFor", () => {
  // Per account: a shared laptop must not silence the prompt for whoever signs
  // in next.
  it("is scoped to the account", () => {
    assert.notEqual(askedKeyFor("user-a"), askedKeyFor("user-b"));
    assert.match(askedKeyFor("user-a"), /user-a$/);
  });
});
