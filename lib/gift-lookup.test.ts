import assert from "node:assert/strict";
import { test } from "node:test";
import { giftById, giftLabel } from "./gift-lookup.ts";
import { LIVE_GIFTS } from "./gifts.ts";

test("a recorded id resolves to the gift that was sent", () => {
  const first = LIVE_GIFTS[0];
  assert.equal(giftById(first.id)?.name, first.name);
  assert.equal(giftById(first.id.toUpperCase())?.id, first.id);
  assert.equal(giftById(` ${first.id} `)?.id, first.id);
});

test("an id this build no longer carries answers null, not a placeholder", () => {
  // The service does not validate the id against a catalogue, so an old tip
  // can name a gift that has since been removed. Inventing an object would
  // show somebody a gift that was never sent.
  assert.equal(giftById("a-gift-that-was-retired"), null);
  assert.equal(giftById(null), null);
  assert.equal(giftById(undefined), null);
  assert.equal(giftById(""), null);
  assert.equal(giftById("   "), null);
});

test("the label falls back to the amount, which was always true", () => {
  assert.equal(giftLabel(LIVE_GIFTS[0].id, "5 KASH"), LIVE_GIFTS[0].name);
  assert.equal(giftLabel(null, "5 KASH"), "5 KASH");
  assert.equal(giftLabel("retired-gift", "5 KASH"), "5 KASH");
});

test("every catalogue id is resolvable — the two never drift apart", () => {
  for (const gift of LIVE_GIFTS) {
    assert.equal(giftById(gift.id)?.id, gift.id, gift.id);
  }
});
