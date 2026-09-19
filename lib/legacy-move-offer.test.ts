import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldOfferLegacyMove } from "./legacy-move-offer.ts";

const input = (over: Partial<Parameters<typeof shouldOfferLegacyMove>[0]> = {}) => ({
  mustClaim: true,
  legacyAvailable: true,
  dismissed: false,
  ...over,
});

describe("offering the old account before the handle is claimed", () => {
  /*
    The whole point. Claiming a handle is the first thing that turns the empty
    shell Square provisioned into somebody's account, and once it is, the
    re-key refuses for good and the person holds two accounts.
  */
  it("offers when a handle is about to be claimed and linking exists", () => {
    assert.equal(shouldOfferLegacyMove(input()), true);
  });

  /*
    An account that already has a handle is past the dangerous moment. Whatever
    it holds, it is theirs, and this screen has nothing useful to say — the
    standing entry on /auth still does.
  */
  it("says nothing to an account that already has a handle", () => {
    assert.equal(shouldOfferLegacyMove(input({ mustClaim: false })), false);
  });

  // Offering a door that is not built leads somewhere worse than not offering.
  it("stays quiet where linking is not part of the deployment", () => {
    assert.equal(shouldOfferLegacyMove(input({ legacyAvailable: false })), false);
  });

  // "I'm new here" is an answer, and asking again on every reload is nagging.
  it("takes no for an answer", () => {
    assert.equal(shouldOfferLegacyMove(input({ dismissed: true })), false);
  });

  it("needs all three, not any", () => {
    assert.equal(shouldOfferLegacyMove(input({ mustClaim: false, dismissed: true })), false);
    assert.equal(
      shouldOfferLegacyMove(input({ legacyAvailable: false, dismissed: true })),
      false
    );
  });
});
