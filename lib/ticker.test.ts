import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateTokenAmount,
  normaliseTicker,
  resolveTicker,
  tickerChangeLabel,
  tickerPriceLabel,
  type TickerMarket,
} from "./ticker.ts";

const BTC: TickerMarket = {
  symbol: "btc",
  name: "Bitcoin",
  priceUsd: 95204.1,
  change24h: 0.69,
  logo: "https://example.test/btc.png",
};

test("a ticker resolves case-insensitively, with or without the sigil", () => {
  // The parser hands us `BTC`; a hand-written call might carry `$btc`. Both
  // must reach the same market or one surface silently shows less than another.
  for (const raw of ["BTC", "btc", "$BTC", " btc "]) {
    assert.equal(resolveTicker(raw, [BTC])?.symbol, "BTC", raw);
    assert.equal(resolveTicker(raw, [BTC])?.name, "Bitcoin", raw);
  }
});

test("the shape matches the post parser's exactly", () => {
  // A symbol the parser would never produce can never reach the sheet, and a
  // symbol it DOES produce must never be refused — that is a chip that opens
  // an empty dialog.
  assert.equal(normaliseTicker("A"), null); // one character
  assert.equal(normaliseTicker("AB"), "AB"); // two is the floor
  assert.equal(normaliseTicker("ABCDEFGHIJ"), "ABCDEFGHIJ"); // ten is the ceiling
  assert.equal(normaliseTicker("ABCDEFGHIJK"), null); // eleven
  assert.equal(normaliseTicker("1BTC"), null); // must start with a letter
  assert.equal(normaliseTicker("BT-C"), null);
  assert.equal(normaliseTicker(""), null);
});

test("an unknown ticker still resolves — to itself, with nothing else", () => {
  // The sheet can honestly say "$FOO" and offer the hand-off without a price.
  // Returning null here would be a chip that does nothing when tapped.
  const resolved = resolveTicker("FOO", [BTC]);
  assert.deepEqual(resolved, {
    symbol: "FOO",
    name: null,
    priceUsd: null,
    change24h: null,
    logo: null,
  });
});

test("a missing catalogue is not a missing ticker", () => {
  assert.equal(resolveTicker("BTC", null)?.symbol, "BTC");
  assert.equal(resolveTicker("BTC", [])?.priceUsd, null);
});

test("a zero price is NO price, not a price of zero", () => {
  // A catalogue that has not resolved a market yet publishes 0. "$0.00" beside
  // a coin tells the reader it is worthless, which is a stronger claim than
  // saying nothing.
  const unpriced = resolveTicker("BTC", [{ ...BTC, priceUsd: 0 }]);
  assert.equal(unpriced?.priceUsd, null);
  assert.equal(unpriced?.name, "Bitcoin");
  assert.equal(resolveTicker("BTC", [{ ...BTC, priceUsd: -1 }])?.priceUsd, null);
  assert.equal(resolveTicker("BTC", [{ ...BTC, priceUsd: NaN }])?.priceUsd, null);
});

test("a change is never shown without a price behind it", () => {
  // A percentage of nothing reads as a live quote when there is none.
  const resolved = resolveTicker("BTC", [{ ...BTC, priceUsd: 0, change24h: 4.2 }]);
  assert.equal(resolved?.change24h, null);
  // With a price, zero and negative changes are real answers and survive.
  assert.equal(resolveTicker("BTC", [{ ...BTC, change24h: 0 }])?.change24h, 0);
  assert.equal(resolveTicker("BTC", [{ ...BTC, change24h: -3 }])?.change24h, -3);
});

test("an empty name is no name", () => {
  // Falling back to the symbol would print "BTC / BTC" as though the catalogue
  // had told us something.
  assert.equal(resolveTicker("BTC", [{ ...BTC, name: "   " }])?.name, null);
});

test("price precision scales so a sub-cent token is never rendered as $0.00", () => {
  assert.equal(tickerPriceLabel(95204.1), "$95,204.10");
  assert.equal(tickerPriceLabel(1), "$1.00");
  assert.equal(tickerPriceLabel(0.5), "$0.5000");
  assert.equal(tickerPriceLabel(0.00001234), "$0.00001234");
  // No price, no label — the caller renders nothing rather than a dash that
  // looks like a number that failed.
  assert.equal(tickerPriceLabel(null), null);
});

test("a change is always signed, with the same minus sign CoinChips uses", () => {
  assert.equal(tickerChangeLabel(0.69), "+0.69%");
  assert.equal(tickerChangeLabel(0), "+0.00%");
  assert.equal(tickerChangeLabel(-1.5), "−1.50%");
  assert.equal(tickerChangeLabel(null), null);
});

test("the token estimate is a preview, capped at four significant figures", () => {
  // More precision would imply an accuracy the source price does not have,
  // and this figure is never sent, signed or compared against a balance.
  assert.equal(estimateTokenAmount("100", 95204.1), "0.00105");
  assert.equal(estimateTokenAmount("100", 2), "50");
  assert.equal(estimateTokenAmount("25", 7), "3.571");
});

test("a very small estimate never renders in exponent notation", () => {
  // "1.234e-7" is not an amount of a coin as far as any reader is concerned.
  const tiny = estimateTokenAmount("1", 20_000_000);
  assert.ok(tiny && !/e/iu.test(tiny), String(tiny));
});

test("an unusable price or amount produces NO line, never NaN", () => {
  assert.equal(estimateTokenAmount("100", null), null);
  assert.equal(estimateTokenAmount("100", 0), null);
  assert.equal(estimateTokenAmount("100", -1), null);
  assert.equal(estimateTokenAmount("100", Number.NaN), null);
  for (const bad of ["", "abc", "0", "-5"]) {
    assert.equal(estimateTokenAmount(bad, 7), null, bad);
  }
});
