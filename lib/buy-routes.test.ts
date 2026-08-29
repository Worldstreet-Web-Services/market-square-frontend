import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BASE_CHAIN_ID,
  SOLANA_CHAIN_ID,
  belowMinimumBuy,
  catalogSymbol,
  displayNetwork,
  displaySymbol,
  isOfferable,
  parseDestinations,
  routesForSymbol,
  type BuyRoute,
} from "./buy-routes.ts";

const cbBTC: BuyRoute = {
  destinationChainId: BASE_CHAIN_ID,
  chainName: "base",
  asset: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
  symbol: "cbBTC",
  decimals: 8,
  logoUrl: null,
};

const ethArbitrum: BuyRoute = {
  destinationChainId: 42161,
  chainName: "arbitrum",
  asset: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  decimals: 18,
  logoUrl: null,
};

const ethBase: BuyRoute = { ...ethArbitrum, destinationChainId: BASE_CHAIN_ID, chainName: "base" };

const solNative: BuyRoute = {
  destinationChainId: SOLANA_CHAIN_ID,
  chainName: "solana",
  asset: "11111111111111111111111111111111",
  symbol: "SOL",
  decimals: 9,
  logoUrl: null,
};

test("$BTC resolves to the wrapped token that can actually be delivered", () => {
  // Bitcoin has no EVM wallet to arrive in, so a BTC buy settles as cbBTC on
  // Base. The reader typed BTC; the catalogue is asked about cbBTC.
  assert.equal(catalogSymbol("BTC"), "CBBTC");
  assert.equal(catalogSymbol("btc"), "CBBTC");
  assert.equal(routesForSymbol([cbBTC], "BTC")[0]?.symbol, "cbBTC");
  // And it reads back as BTC wherever it is shown.
  assert.equal(displaySymbol("cbBTC"), "BTC");
  assert.equal(displayNetwork("cbBTC", "base"), "Bitcoin");
});

test("a symbol with no alias passes through untouched", () => {
  assert.equal(catalogSymbol("eth"), "ETH");
  assert.equal(displaySymbol("ETH"), "ETH");
  assert.equal(displayNetwork("ETH", "base"), "base");
});

test("SOLANA destinations are never offerable", () => {
  // The failure this prevents: a route that quotes, takes USDC on Base, and
  // has nowhere to deliver — Market Square holds no Solana wallet.
  assert.equal(isOfferable(solNative), false);
  assert.deepEqual(routesForSymbol([solNative], "SOL"), []);
  assert.equal(routesForSymbol([solNative], "SOL")[0], undefined);
});

test("a chain we cannot receive on is not offered", () => {
  assert.equal(isOfferable({ ...ethArbitrum, chainName: "tron" }), false);
  assert.equal(isOfferable({ ...ethArbitrum, chainName: "bitcoin" }), false);
  assert.equal(isOfferable({ ...ethArbitrum, chainName: "" }), false);
  // Case and padding in the catalogue's own label must not exclude a good one.
  assert.equal(isOfferable({ ...ethArbitrum, chainName: " Arbitrum " }), true);
});

test("Base is preferred, then chains sort by name", () => {
  // Both the default selection and "there is no chain choice to offer" fall
  // out of this one ordering.
  const routes = routesForSymbol([ethArbitrum, ethBase], "ETH");
  assert.deepEqual(
    routes.map((r) => r.chainName),
    ["base", "arbitrum"]
  );
  assert.equal(routesForSymbol([ethArbitrum, ethBase], "ETH")[0]?.chainName, "base");
});

test("an unknown symbol has no route rather than a wrong one", () => {
  assert.deepEqual(routesForSymbol([cbBTC, ethBase], "FOO"), []);
  assert.deepEqual(routesForSymbol(null, "BTC"), []);
  assert.deepEqual(routesForSymbol(undefined, "BTC"), []);
});

test("the minimum is compared in base units, never as a float", () => {
  assert.equal(belowMinimumBuy("0.99"), true);
  assert.equal(belowMinimumBuy("0.999999"), true);
  assert.equal(belowMinimumBuy("1"), false);
  assert.equal(belowMinimumBuy("1.00"), false);
  assert.equal(belowMinimumBuy("10"), false);
});

test("an invalid amount is not 'below the minimum'", () => {
  // Showing somebody a minimum when what they typed was "abc" answers a
  // question they did not ask.
  for (const bad of ["", "abc", "-1", "0", "1e3"]) {
    assert.equal(belowMinimumBuy(bad), false, bad);
  }
});

test("catalogue rows missing a chain or a token are DROPPED, never defaulted", () => {
  // There is no sensible default for "which token" — a defaulted row is a
  // transaction pointed at the wrong contract.
  const parsed = parseDestinations([
    { destinationChainId: BASE_CHAIN_ID, currency: "0xabc", symbol: "AAA", decimals: 6 },
    { currency: "0xdef", symbol: "BBB" }, // no chain
    { destinationChainId: BASE_CHAIN_ID, symbol: "CCC" }, // no token
    { destinationChainId: BASE_CHAIN_ID, currency: "0x111", symbol: "  " }, // no symbol
    { destinationChainId: "8453", currency: "0x222", symbol: "DDD" }, // chain as a string
  ]);
  assert.deepEqual(
    parsed.map((r) => r.symbol),
    ["AAA"]
  );
});

test("decimals fall back to 18 — a preview, never a payment", () => {
  const [route] = parseDestinations({
    destinations: [{ destinationChainId: BASE_CHAIN_ID, currency: "0xabc", symbol: "AAA" }],
  });
  assert.equal(route.decimals, 18);
  assert.equal(route.logoUrl, null);
});

test("a payload that is not a catalogue parses to nothing, not a throw", () => {
  for (const junk of [null, undefined, {}, "", 3, { destinations: "nope" }]) {
    assert.deepEqual(parseDestinations(junk), [], String(junk));
  }
});

test("a WRAPPED coin is never sold under the native coin's ticker", () => {
  // The live catalogue offers SOL twice: native SOL on Solana, and an ERC-20
  // "SOL" on Base. Someone tapping $SOL means the first. Selling them the
  // second under the same ticker is a substitution only noticed later, in a
  // wallet that does not hold what its owner thinks it holds.
  const wrappedSolOnBase: BuyRoute = {
    destinationChainId: BASE_CHAIN_ID,
    chainName: "base",
    asset: "0x311935cd80b76769bf9f9b2fdbd1d1e0d5b0a3f0",
    symbol: "SOL",
    decimals: 9,
    logoUrl: null,
  };
  assert.equal(isOfferable(wrappedSolOnBase), false);
  assert.deepEqual(routesForSymbol([wrappedSolOnBase, solNative], "SOL"), []);
});

test("a legitimately multi-chain asset is not pinned", () => {
  // ETH on an L2 really is ETH. The pin exists for wrappers, not for every
  // coin that appears more than once.
  assert.equal(isOfferable(ethArbitrum), true);
  assert.equal(isOfferable(ethBase), true);
});

test("every chain wsws vets is offerable here too, except Solana", () => {
  // Shortening the list silently drops coins that are perfectly deliverable —
  // all of these are EVM and arrive in the one embedded wallet.
  for (const chainName of [
    "base", "ethereum", "arbitrum", "optimism", "polygon", "apechain", "berachain",
    "bsc", "celo", "gensyn", "hyperevm", "ink", "monad", "robinhood", "shape",
    "soneium", "unichain", "world-chain", "gnosis", "linea", "zksync", "scroll",
    "avalanche", "blast", "zora", "ronin", "abstract", "mythos",
  ]) {
    assert.equal(
      isOfferable({ ...ethArbitrum, symbol: "XYZ", chainName, destinationChainId: 999 }),
      true,
      chainName
    );
  }
});
