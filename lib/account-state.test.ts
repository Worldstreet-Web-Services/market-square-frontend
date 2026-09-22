import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gateDecision,
  readCachedAccountState,
  recallSignInEmail,
  recordUpgradeDeclined,
  rememberSignInEmail,
  upgradeDeclined,
  writeCachedAccountState,
} from "./account-state.ts";

const base = { enabled: true, ready: true, authenticated: true, dismissed: false } as const;

describe("the migration gate's decision", () => {
  /*
    The whole point: a legacy account gets the upgrade BEFORE the app makes
    anything under the new id.
  */
  it("holds a legacy account at the upgrade", () => {
    assert.equal(gateDecision({ ...base, state: "legacy" }), "upgrade");
  });

  // Nothing that talks to Square may render until the answer is in.
  it("renders nothing of the app while the answer is on its way", () => {
    assert.equal(gateDecision({ ...base, state: undefined }), "checking");
  });

  it("lets new, linked and unknown accounts straight in", () => {
    for (const state of ["new", "linked", "unknown"] as const) {
      assert.equal(gateDecision({ ...base, state }), "app", state);
    }
  });

  // "I'm new here" is an answer, and asking again on every reload is nagging.
  it("takes no for an answer", () => {
    assert.equal(gateDecision({ ...base, state: "legacy", dismissed: true }), "app");
  });

  // Signed-out browsing is supported, and hydration must not flash a check.
  it("never gates a signed-out or still-hydrating session", () => {
    assert.equal(gateDecision({ ...base, authenticated: false, state: undefined }), "app");
    assert.equal(gateDecision({ ...base, ready: false, state: undefined }), "app");
  });

  it("never gates a deployment without linking", () => {
    assert.equal(gateDecision({ ...base, enabled: false, state: "legacy" }), "app");
  });
});

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("what the browser remembers", () => {
  /*
    `legacy` is the one answer that changes — by linking — so a kept copy
    would keep sending somebody through an upgrade they have finished.
  */
  it("keeps only settled answers", () => {
    const s = memoryStorage();
    writeCachedAccountState(s, "a", "linked");
    assert.equal(readCachedAccountState(s, "a"), "linked");
    writeCachedAccountState(s, "a", "legacy");
    assert.equal(readCachedAccountState(s, "a"), undefined);
    writeCachedAccountState(s, "a", "unknown");
    assert.equal(readCachedAccountState(s, "a"), undefined);
  });

  it("keeps the email and the decision per account, never across them", () => {
    const s = memoryStorage();
    rememberSignInEmail(s, "a", "a@example.com");
    recordUpgradeDeclined(s, "a");
    assert.equal(recallSignInEmail(s, "a"), "a@example.com");
    assert.equal(recallSignInEmail(s, "b"), null);
    assert.equal(upgradeDeclined(s, "a"), true);
    assert.equal(upgradeDeclined(s, "b"), false);
  });

  it("survives a storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    assert.equal(readCachedAccountState(broken, "a"), undefined);
    assert.equal(upgradeDeclined(broken, "a"), false);
    assert.equal(recallSignInEmail(broken, "a"), null);
    assert.doesNotThrow(() => writeCachedAccountState(broken, "a", "new"));
    assert.doesNotThrow(() => rememberSignInEmail(broken, "a", "x@y.z"));
    assert.doesNotThrow(() => recordUpgradeDeclined(broken, "a"));
  });
});
