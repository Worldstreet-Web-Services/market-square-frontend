import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getAuthSnapshot, hasHeldSession, setAuthSnapshot } from "./session.ts";

/**
 * "YOUR SESSION ENDED" AND "YOU WERE NEVER SIGNED IN" ARE DIFFERENT ANSWERS.
 *
 * The ready/authenticated pair cannot tell them apart — both read
 * `{ ready: true, authenticated: false }` — so `apiFetch` reported every gated
 * 401 as an expiry. A signed-out visitor was told their session had expired,
 * which was untrue, and the guard pushed them to /auth off a public page. The
 * first gated poll fires within a second of load, so the front door was
 * effectively unreachable while signed out.
 */
test("a browser that has never signed in has held no session", () => {
  setAuthSnapshot({ ready: false, authenticated: false });
  assert.equal(hasHeldSession(), false);
  setAuthSnapshot({ ready: true, authenticated: false });
  assert.equal(
    hasHeldSession(),
    false,
    "settled-and-signed-out is a GUEST, not an expiry"
  );
});

test("signing in latches it on", () => {
  setAuthSnapshot({ ready: true, authenticated: true });
  assert.equal(hasHeldSession(), true);
});

test("it STAYS on once the session goes — that is when expiry must still fire", () => {
  setAuthSnapshot({ ready: true, authenticated: true });
  setAuthSnapshot({ ready: true, authenticated: false });
  assert.equal(
    hasHeldSession(),
    true,
    "a real expiry now reads as a guest and is silently swallowed"
  );
});

test("the snapshot itself is still mirrored verbatim", () => {
  setAuthSnapshot({ ready: true, authenticated: false });
  assert.deepEqual(getAuthSnapshot(), { ready: true, authenticated: false });
});
