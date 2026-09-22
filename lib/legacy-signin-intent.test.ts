import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { intentIsLive } from "./legacy-signin-intent.ts";

const NOW = 1_800_000_000_000;
const record = (owner: string | null, at = NOW) => JSON.stringify({ owner, at });

describe("whether a recorded sign-in intent vouches for the session on screen", () => {
  it("does, for the account that asked, while fresh", () => {
    assert.equal(intentIsLive(record("0xabc"), "0xabc", NOW + 30_000), true);
  });

  /*
    Seen live: one test account's old session was linked to the NEXT test
    account in the same tab, because the marker from the first flow was still
    there and said nothing about who had set it.
  */
  it("never vouches for a different new account", () => {
    assert.equal(intentIsLive(record("0xabc"), "0xdef", NOW), false);
    assert.equal(intentIsLive(record("0xabc"), null, NOW), false);
  });

  // /move-account asks for the old account BEFORE the new one exists.
  it("vouches for whoever the new account turns out to be when none existed yet", () => {
    assert.equal(intentIsLive(record(null), "0xabc", NOW), true);
    assert.equal(intentIsLive(record(null), null, NOW), true);
  });

  // A marker never cleared — a tab left mid-flow, a crash after the redirect
  // — must not vouch for a session hours later.
  it("expires", () => {
    assert.equal(intentIsLive(record("0xabc"), "0xabc", NOW + 9 * 60_000), true);
    assert.equal(intentIsLive(record("0xabc"), "0xabc", NOW + 11 * 60_000), false);
    // A clock that went backwards is not a fresh intent either.
    assert.equal(intentIsLive(record("0xabc", NOW + 60_000), "0xabc", NOW), false);
  });

  it("reads nothing, rubbish and the old bare flag as no intent", () => {
    for (const recorded of [null, "", "1", "{", JSON.stringify({ owner: "0xabc" })]) {
      assert.equal(intentIsLive(recorded, "0xabc", NOW), false, String(recorded));
    }
  });
});
