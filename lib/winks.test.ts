import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WINK_BUDGET,
  WINK_COOLDOWN_MS,
  WINK_WINDOW_MS,
  describeWinkRefusal,
  hasWinked,
  humaniseWait,
  lastWinkAt,
  recordWink,
  retryAfterFromDetails,
  winkEligibility,
  winksInWindow,
  type WinkRecord,
} from "./winks.ts";

const NOW = 1_800_000_000_000;
const base = {
  viewerId: "u_me",
  targetId: "u_them",
  targetBlocked: false,
  sent: [] as WinkRecord[],
  now: NOW,
};

const minutesAgo = (n: number) => NOW - n * 60_000;

test("a first wink at a stranger is allowed", () => {
  assert.deepEqual(winkEligibility(base), { ok: true });
});

test("you cannot wink yourself", () => {
  // A self-wink notifies nobody, so it is refused permanently rather than
  // rate-limited — there is no wait that would make it work.
  const result = winkEligibility({ ...base, targetId: "u_me" });
  assert.deepEqual(result, { ok: false, reason: "self", retryAfterMs: 0 });
});

test("you cannot wink somebody you have blocked", () => {
  // The half of the block guarantee a browser can hold: never send INTO a
  // block this viewer set. The other direction is the service's job.
  const result = winkEligibility({ ...base, targetBlocked: true });
  assert.deepEqual(result, { ok: false, reason: "blocked", retryAfterMs: 0 });
});

test("a block outranks a spent budget", () => {
  // The reader must be told the permanent reason, not a wait that will not
  // help. Ordering is the whole point of the function.
  const spent = Array.from({ length: WINK_BUDGET }, (_, i) => ({
    targetId: `u_${i}`,
    at: minutesAgo(1),
  }));
  const result = winkEligibility({ ...base, targetBlocked: true, sent: spent });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "blocked");
});

test("the same person cannot be winked twice inside the cooldown", () => {
  const sent = [{ targetId: "u_them", at: minutesAgo(60) }];
  const result = winkEligibility({ ...base, sent });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.reason, "cooling-down");
  assert.equal(
    result.ok === false && result.retryAfterMs,
    WINK_COOLDOWN_MS - 60 * 60_000
  );
});

test("the cooldown expires and the same person can be winked again", () => {
  const sent = [{ targetId: "u_them", at: NOW - WINK_COOLDOWN_MS - 1 }];
  assert.deepEqual(winkEligibility({ ...base, sent }), { ok: true });
});

test("the cooldown outranks the budget, because it is the specific answer", () => {
  // Both are true here. "You already winked them" is the one that tells the
  // reader something they can act on.
  const sent: WinkRecord[] = [
    { targetId: "u_them", at: minutesAgo(5) },
    ...Array.from({ length: WINK_BUDGET }, (_, i) => ({ targetId: `u_${i}`, at: minutesAgo(2) })),
  ];
  const result = winkEligibility({ ...base, sent });
  assert.equal(result.ok === false && result.reason, "cooling-down");
});

test("the budget stops the twelfth-plus wink in the window", () => {
  const sent = Array.from({ length: WINK_BUDGET }, (_, i) => ({
    targetId: `u_${i}`,
    at: minutesAgo(10),
  }));
  const result = winkEligibility({ ...base, sent });
  assert.equal(result.ok === false && result.reason, "budget-spent");
});

test("the budget is a ROLLING window — it frees up as the oldest wink ages out", () => {
  // Not "wait an hour from now": the reader gets a slot back the moment the
  // earliest wink in the window falls out of it.
  const sent = [
    { targetId: "u_0", at: NOW - WINK_WINDOW_MS + 5 * 60_000 },
    ...Array.from({ length: WINK_BUDGET - 1 }, (_, i) => ({
      targetId: `u_${i + 1}`,
      at: minutesAgo(1),
    })),
  ];
  const result = winkEligibility({ ...base, sent });
  assert.equal(result.ok === false && result.reason, "budget-spent");
  assert.equal(result.ok === false && result.retryAfterMs, 5 * 60_000);
});

test("winks older than the window do not count against the budget", () => {
  const sent = Array.from({ length: WINK_BUDGET }, (_, i) => ({
    targetId: `u_${i}`,
    at: NOW - WINK_WINDOW_MS - 1,
  }));
  assert.deepEqual(winkEligibility({ ...base, sent }), { ok: true });
  assert.deepEqual(winksInWindow(sent, NOW), []);
});

test("an undeployed route refuses before anything else is considered", () => {
  // Nothing can be sent at all, so no other reason is worth computing.
  const result = winkEligibility({ ...base, available: false });
  assert.deepEqual(result, { ok: false, reason: "unavailable", retryAfterMs: 0 });
});

test("recording a wink prunes entries that can no longer decide anything", () => {
  const stale = { targetId: "u_old", at: NOW - WINK_COOLDOWN_MS - 1 };
  const fresh = { targetId: "u_recent", at: minutesAgo(30) };
  const next = recordWink([stale, fresh], "u_them", NOW);
  assert.deepEqual(next, [fresh, { targetId: "u_them", at: NOW }]);
});

test("recording does not mutate the stored list", () => {
  // The list is persisted and shared with every mounted wink button.
  const sent = [{ targetId: "u_a", at: minutesAgo(1) }];
  const copy = [...sent];
  recordWink(sent, "u_b", NOW);
  assert.deepEqual(sent, copy);
});

test("hasWinked tracks the cooldown, not all history", () => {
  assert.equal(hasWinked([{ targetId: "u_them", at: minutesAgo(1) }], "u_them", NOW), true);
  assert.equal(
    hasWinked([{ targetId: "u_them", at: NOW - WINK_COOLDOWN_MS - 1 }], "u_them", NOW),
    false
  );
  assert.equal(hasWinked([], "u_them", NOW), false);
});

test("lastWinkAt takes the most recent, not the first found", () => {
  const sent = [
    { targetId: "u_them", at: minutesAgo(90) },
    { targetId: "u_other", at: minutesAgo(2) },
    { targetId: "u_them", at: minutesAgo(10) },
  ];
  assert.equal(lastWinkAt(sent, "u_them"), minutesAgo(10));
  assert.equal(lastWinkAt(sent, "u_nobody"), null);
});

test("a block refusal never reports the other person's state", () => {
  // It names only what this viewer did. Saying "they blocked you" would hand
  // the sender the confirmation blocking exists to withhold.
  const copy = describeWinkRefusal("blocked", 0);
  assert.equal(copy, "You've blocked them. Unblock to send a wink.");
  assert.equal(/they|them blocked|blocked you/i.test(copy.replace("them.", "")), false);
});

test("refusal copy tells the reader what to do next", () => {
  assert.equal(describeWinkRefusal("self", 0), "You can't wink yourself.");
  assert.equal(
    describeWinkRefusal("cooling-down", 2 * 60 * 60 * 1000),
    "You've already winked them. You can again in about 2 hours."
  );
  assert.equal(
    describeWinkRefusal("budget-spent", 5 * 60_000),
    "That's your winks for now — more in 5 minutes."
  );
  assert.equal(describeWinkRefusal("unavailable", 0), "Winks aren't switched on yet.");
});

test("a wait is never reported as zero", () => {
  // "Try again in 0 minutes" reads as broken; a sub-minute wait rounds up.
  assert.equal(humaniseWait(1_000), "in 1 minute");
  assert.equal(humaniseWait(0), "in 1 minute");
  assert.equal(humaniseWait(59 * 60_000), "in 59 minutes");
  assert.equal(humaniseWait(60 * 60_000), "in about 1 hour");
});

test("a service 429 is read from its documented details shape", () => {
  assert.equal(retryAfterFromDetails({ retryAfterSeconds: 90 }), 90_000);
  // Missing or nonsensical values fall back to our own window rather than to
  // zero — retrying instantly after a 429 just spends the next request.
  assert.equal(retryAfterFromDetails({}), WINK_WINDOW_MS);
  assert.equal(retryAfterFromDetails(null), WINK_WINDOW_MS);
  assert.equal(retryAfterFromDetails({ retryAfterSeconds: 0 }), WINK_WINDOW_MS);
  assert.equal(retryAfterFromDetails("nope"), WINK_WINDOW_MS);
});
