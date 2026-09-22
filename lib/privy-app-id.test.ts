import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PLACEHOLDER_PRIVY_APP_ID, looksLikePrivyAppId, privyAppId } from "./privy-app-id.ts";

describe("The provider is only ever handed an id it can mount with", () => {
  it("keeps a real id untouched", () => {
    assert.equal(privyAppId("cmrv8k0hd00b40cldl4p0d08g"), "cmrv8k0hd00b40cldl4p0d08g");
  });

  it("replaces one that cannot be a Privy id", () => {
    // THIS IS THE BUILD BREAK. CI set `ci-placeholder` as a deliberate
    // non-secret; the old fallback only covered an EMPTY value, so the
    // malformed one reached PrivyProvider, which throws rather than degrades —
    // and the throw happened while prerendering, failing every gates run.
    assert.equal(privyAppId("ci-placeholder"), PLACEHOLDER_PRIVY_APP_ID);
    assert.equal(privyAppId("changeme"), PLACEHOLDER_PRIVY_APP_ID);
    assert.equal(privyAppId("CMRV8K0HD00B40CLDL4P0D08G"), PLACEHOLDER_PRIVY_APP_ID);
  });

  it("replaces an absent one, which is what it always did", () => {
    assert.equal(privyAppId(undefined), PLACEHOLDER_PRIVY_APP_ID);
    assert.equal(privyAppId(""), PLACEHOLDER_PRIVY_APP_ID);
    assert.equal(privyAppId("   "), PLACEHOLDER_PRIVY_APP_ID);
  });

  it("uses a placeholder that is well-formed and belongs to nobody", () => {
    assert.equal(looksLikePrivyAppId(PLACEHOLDER_PRIVY_APP_ID), true);
  });
});
