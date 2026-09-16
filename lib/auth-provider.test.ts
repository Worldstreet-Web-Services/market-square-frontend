import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAuthProvider } from "./auth-provider.ts";

const PRIVY = "cl0123456789abcdefghijklm";
const DECANE = "c8926bd9-07fc-46db-98aa-33f8c789fa74";

describe("today's behaviour is unchanged", () => {
  it("is privy whenever a privy app id is configured", () => {
    assert.equal(resolveAuthProvider({ privyAppId: PRIVY }), "privy");
  });

  it("is demo with nothing configured — the floor DEMO_AUTH has always meant", () => {
    assert.equal(resolveAuthProvider({}), "demo");
    assert.equal(resolveAuthProvider({ privyAppId: null }), "demo");
    assert.equal(resolveAuthProvider({ privyAppId: undefined }), "demo");
  });

  it("treats a declared-but-empty variable as absent", () => {
    // `process.env.X` is "" for `X=` in an env file, which is the commonest
    // way a config is half-written.
    assert.equal(resolveAuthProvider({ privyAppId: "" }), "demo");
    assert.equal(resolveAuthProvider({ privyAppId: "   " }), "demo");
  });
});

describe("half-configured Decane is NEVER active", () => {
  it("ignores an app id while the flag is off — that is somebody preparing", () => {
    assert.equal(resolveAuthProvider({ privyAppId: PRIVY, decaneAppId: DECANE }), "privy");
    assert.equal(
      resolveAuthProvider({ privyAppId: PRIVY, decaneAppId: DECANE, decaneEnabled: false }),
      "privy"
    );
  });

  it("ignores the flag with no app id — honouring it would mount a provider that cannot mint a token", () => {
    assert.equal(resolveAuthProvider({ privyAppId: PRIVY, decaneEnabled: true }), "privy");
    assert.equal(
      resolveAuthProvider({ privyAppId: PRIVY, decaneEnabled: true, decaneAppId: "" }),
      "privy"
    );
  });

  it("falls to demo, not decane, when the flag is on and NOTHING else is configured", () => {
    // The dangerous case: a flag flipped in an environment that has neither id
    // must not produce a provider at all.
    assert.equal(resolveAuthProvider({ decaneEnabled: true }), "demo");
    assert.equal(resolveAuthProvider({ decaneEnabled: true, decaneAppId: "  " }), "demo");
  });
});

describe("switching deliberately", () => {
  it("is decane only with BOTH the flag and an app id", () => {
    assert.equal(resolveAuthProvider({ decaneEnabled: true, decaneAppId: DECANE }), "decane");
  });

  it("prefers decane over privy during the dual-auth window", () => {
    // Both configured is the migration window itself. The flag is the opt-in,
    // so it decides where NEW sign-ins go; an existing Privy session keeps
    // working because every service accepts either token — which is a runtime
    // fact this function deliberately cannot see.
    assert.equal(
      resolveAuthProvider({ privyAppId: PRIVY, decaneAppId: DECANE, decaneEnabled: true }),
      "decane"
    );
  });

  it("only `true` opts in, never a stray truthy value", () => {
    assert.equal(
      resolveAuthProvider({
        privyAppId: PRIVY,
        decaneAppId: DECANE,
        decaneEnabled: undefined,
      }),
      "privy"
    );
  });
});
