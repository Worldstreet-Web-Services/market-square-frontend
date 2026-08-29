import assert from "node:assert/strict";
import { test } from "node:test";
import { HOLD_TTL_MS, holdKey, newIntentId, parseHold, reusableHold } from "./payment-hold.ts";

const TX = "0xfeedface";
const NOW = 1_700_000_000_000;
const held = (key: string | null, createdAt = NOW) => ({
  key: key as string,
  txHash: TX,
  createdAt,
});

test("the same money is the same attempt however it was typed", () => {
  // The double-charge this exists to prevent: a buyer whose credit failed
  // retypes the amount slightly differently, the key no longer matches their
  // held receipt, and they pay a second time for one purchase.
  const canonical = holdKey("kash-purchase", "10");
  for (const written of ["10", "10.0", "10.00", "010", "010.000000"]) {
    assert.equal(holdKey("kash-purchase", written), canonical, written);
  }
});

test("a different amount is a different attempt", () => {
  // The other direction, and it is just as expensive: crediting an old $10
  // payment against a new $50 one shorts the buyer by forty dollars.
  assert.notEqual(holdKey("kash-purchase", "10"), holdKey("kash-purchase", "50"));
  assert.notEqual(holdKey("kash-purchase", "10"), holdKey("kash-purchase", "10.01"));
});

test("a different purpose is a different attempt", () => {
  assert.notEqual(holdKey("kash-purchase", "10"), holdKey("token-buy", "10"));
});

test("an unpayable amount has no key at all", () => {
  // A key built from garbage would happily match another key built from
  // different garbage.
  for (const bad of ["", " ", "abc", "-1", "1e3", ".5", "1,000", "0", "0.00"]) {
    assert.equal(holdKey("kash-purchase", bad), null, bad);
  }
});

test("a retry of the SAME attempt reuses the settled payment", () => {
  const key = holdKey("kash-purchase", "10");
  assert.equal(reusableHold(held(key), key, NOW)?.txHash, TX);
  // Written differently, still the same attempt, still reused.
  assert.equal(reusableHold(held(key), holdKey("kash-purchase", "10.00"), NOW)?.txHash, TX);
});

test("a retry of a DIFFERENT attempt never reuses it", () => {
  const hold = held(holdKey("kash-purchase", "10"));
  assert.equal(reusableHold(hold, holdKey("kash-purchase", "50"), NOW), null);
  assert.equal(reusableHold(hold, holdKey("token-buy", "10"), NOW), null);
});

test("nothing held, or nothing to match, means nothing to reuse", () => {
  assert.equal(reusableHold(null, holdKey("kash-purchase", "10"), NOW), null);
  assert.equal(reusableHold(held("kash-purchase:10."), null, NOW), null);
});

test("a hold expires, so a stale hash can never answer a new purchase", () => {
  // The failure at the far end of the window: the credit actually landed and
  // only its response was lost, so the hold survives holding a hash the engine
  // has already settled. Reusing it later answers a genuinely new purchase
  // with "already credited" and delivers nothing.
  const key = holdKey("kash-purchase", "10");
  assert.equal(reusableHold(held(key), key, NOW + HOLD_TTL_MS - 1)?.txHash, TX);
  assert.equal(reusableHold(held(key), key, NOW + HOLD_TTL_MS + 1), null);
});

test("a hold from the future is corrupt, not recent", () => {
  const key = holdKey("kash-purchase", "10");
  assert.equal(reusableHold(held(key, NOW + 60_000), key, NOW), null);
});

test("a stored hold is validated before it can influence a payment", () => {
  // It comes back from session storage — which is to say, from something a
  // person can edit.
  assert.deepEqual(parseHold({ key: "k", txHash: TX, createdAt: NOW }), {
    key: "k",
    txHash: TX,
    createdAt: NOW,
  });
  for (const junk of [
    null,
    undefined,
    "string",
    42,
    {},
    { key: "k", txHash: TX },
    { key: "", txHash: TX, createdAt: NOW },
    { key: "k", txHash: "", createdAt: NOW },
    { key: "k", txHash: "not-a-hash", createdAt: NOW },
    { key: "k", txHash: TX, createdAt: "yesterday" },
    { key: "k", txHash: TX, createdAt: Number.NaN },
  ]) {
    assert.equal(parseHold(junk), null, JSON.stringify(junk));
  }
});

test("an intent id comes from the generator, and two attempts differ", () => {
  // Proves the id is taken from where intent begins rather than re-derived
  // inside a request — a key minted per request is new on every retry and
  // protects nothing.
  let n = 0;
  const uuid = () => `fixed-${(n += 1)}`;
  assert.equal(newIntentId("kash-purchase", uuid), "kash-purchase-fixed-1");
  assert.equal(newIntentId("kash-purchase", uuid), "kash-purchase-fixed-2");
});
