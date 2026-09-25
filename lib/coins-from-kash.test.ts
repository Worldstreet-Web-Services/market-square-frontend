import assert from "node:assert/strict";
import { test } from "node:test";
import { coinsFromKash } from "./coins-from-kash.ts";

/*
  COINS ARE A VIEW OF KASH.

  ogazboiz was looking at 0.11 KASH in his wallet and a coin balance reading
  ZERO — because coins were a bought, stored balance and the purchase that
  would have credited it never settled. Under the denomination model that
  screen reads 110, and no purchase exists to fail.
*/

const RATE = 1000;

test("the screen that prompted this: 0.11 KASH is 110 coins", () => {
  assert.equal(coinsFromKash("0.11", RATE), 110);
});

test("the ladder people actually hold", () => {
  for (const [kash, coins] of [
    ["0.01", 10], // one rose, the cheapest gift there is
    ["0.02", 20],
    ["0.05", 50],
    ["0.14", 140],
    ["1", 1000],
    ["50", 50000],
  ] as const) {
    assert.equal(coinsFromKash(kash, RATE), coins, `${kash} KASH`);
  }
});

test("ROUNDS DOWN, so every coin shown is a coin that can be spent", () => {
  /*
    0.0115 KASH is 11.5 coins. Rounding up offers a twelfth the send would
    refuse — the interface promising what the money cannot cover.
  */
  assert.equal(coinsFromKash("0.0115", RATE), 11);
  assert.equal(coinsFromKash("0.0119", RATE), 11);
  assert.equal(coinsFromKash("0.0999", RATE), 99);
});

test("no float arithmetic — the amounts where it would silently lose a coin", () => {
  /*
    `Number("0.29") * 1000` is 289.99999999999994, which floors to 289. A coin
    missing from somebody's balance, on an amount a real person holds.
  */
  assert.equal(coinsFromKash("0.29", RATE), 290);
  assert.equal(coinsFromKash("0.57", RATE), 570);
  assert.equal(coinsFromKash("1.005", RATE), 1005);
  assert.equal(coinsFromKash("8.87", RATE), 8870);
});

test("NULL IS NOT KNOWN, never a confident zero", () => {
  /*
    The rule every balance here follows. A rate still loading or a balance
    still in flight rendering as `0 coins` is the interface inventing a
    shortfall — and telling somebody who HAS money that they have none.
  */
  for (const bad of [null, undefined, "", "   ", "abc", "-1", "1,000", "0x10"]) {
    assert.equal(coinsFromKash(bad as string, RATE), null, `kash ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, 0, -1, 1.5, Number.NaN]) {
    assert.equal(coinsFromKash("1", bad as number), null, `rate ${String(bad)}`);
  }
});

test("a genuine zero balance is zero, and is told apart from not knowing", () => {
  assert.equal(coinsFromKash("0", RATE), 0);
  assert.equal(coinsFromKash("0.000", RATE), 0);
  // Below one coin is zero coins — true, and not the same as `null`.
  assert.equal(coinsFromKash("0.0009", RATE), 0);
});

test("the rate is the service's, so a reprice moves every number at once", () => {
  assert.equal(coinsFromKash("0.11", 100), 11);
  assert.equal(coinsFromKash("0.11", 10000), 1100);
});
