import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_GIFTS } from "./gifts.ts";
import { MAX_TIP_DECIMALS, TIP_PRESETS_KASH, parseTipAmount } from "./tips.ts";

/**
 * The ladder is a PRODUCT decision denominated in a $7 token, and the failure
 * it guards against has already happened once: prices written as though KASH
 * were a cheap point put a $7 rose and a $7,000 coin in the tray, which is
 * 560x TikTok's cheapest gift and 16x its dearest. Nobody noticed, because
 * nothing in the code knew the numbers meant dollars.
 *
 * These assertions cannot know what a gift SHOULD cost. They pin the
 * properties that made the mistake possible: an order that means something, a
 * precision the client can actually send, and a ceiling that cannot silently
 * climb back into four figures.
 */
test("the ladder climbs, and every rung is distinct", () => {
  const prices = LIVE_GIFTS.map((gift) => Number(gift.priceKash));
  for (let index = 1; index < prices.length; index += 1) {
    assert.ok(
      prices[index] > prices[index - 1],
      `${LIVE_GIFTS[index].name} (${prices[index]}) must cost more than ` +
        `${LIVE_GIFTS[index - 1].name} (${prices[index - 1]}) — the tray is read as a ladder`
    );
  }
  assert.equal(new Set(LIVE_GIFTS.map((gift) => gift.id)).size, LIVE_GIFTS.length);
});

test("every price is an amount the client can actually send", () => {
  // A rung below MAX_TIP_DECIMALS is rejected as `too-precise` before it ever
  // reaches the wire, so it would be a gift nobody can buy.
  for (const gift of LIVE_GIFTS) {
    const parsed = parseTipAmount(gift.priceKash);
    assert.equal(parsed.ok, true, `${gift.name} at ${gift.priceKash} must parse`);
    if (parsed.ok) {
      assert.equal(parsed.amountKash, gift.priceKash, `${gift.name} must already be canonical`);
    }
    const decimals = gift.priceKash.split(".")[1]?.length ?? 0;
    assert.ok(decimals <= MAX_TIP_DECIMALS, `${gift.name} is too precise to send`);
  }
});

test("the ladder stays inside a sane band for a $7 token", () => {
  const KASH_USD = 7;
  const cheapest = Number(LIVE_GIFTS[0].priceKash) * KASH_USD;
  const dearest = Number(LIVE_GIFTS[LIVE_GIFTS.length - 1].priceKash) * KASH_USD;
  // TikTok's rose is $0.0125 and its most expensive gift ever ~$437. A tray
  // whose entry point costs more than a coffee, or whose top rung costs more
  // than a flight, is the bug this exists to catch.
  assert.ok(cheapest <= 1, `cheapest gift is $${cheapest.toFixed(2)} — too steep to be an impulse`);
  assert.ok(dearest <= 500, `dearest gift is $${dearest.toFixed(2)} — beyond anything TikTok sells`);
});

test("tip presets remain a subset of the gift ladder", () => {
  // Stated as a rule in lib/tips.ts, unenforced until now: a "10" must mean
  // the same thing whether it is tapped as a gift or typed as a tip.
  const prices = new Set(LIVE_GIFTS.map((gift) => gift.priceKash));
  for (const preset of TIP_PRESETS_KASH) {
    assert.ok(prices.has(preset), `tip preset ${preset} has no gift at that price`);
  }
});
