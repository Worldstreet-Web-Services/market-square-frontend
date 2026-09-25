import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  alchemyKeys,
  alchemyKeysInOrder,
  alchemyPairs,
  hasAlchemyKey,
  isAlchemyKeyBlocked,
  markAlchemyKeyBlocked,
  resetAlchemyKeyBlocks,
  MONTHLY_CAPACITY_COOLDOWN_MS,
  pairCannotServe,
} from "./alchemy-keys.ts";

import { readEvm, resetEvmReadState } from "./evm-read.ts";

/*
  THE ALCHEMY KEY POOL, AND THE READ PATH IN FRONT OF IT.

  One key and one policy, both read at module load, is what this replaces. When
  that single Alchemy app hit its rate limit every sponsored send in the app
  failed at once — buying coins included. Reads survive a throttled key because
  they fall back; SPONSORSHIP CANNOT, because nothing else pays our gas.

  Ported from wsws, which hit this in production on 2026-09-07
  (ADR-2026-09-07-alchemy-key-pool). These pin the parts that are easy to get
  subtly wrong and impossible to notice: the index pairing, and a refusal that
  arrives inside a 200.
*/

const ENV = [
  "ALCHEMY_API_KEY",
  "ALCHEMY_API_KEY_FALLBACK",
  "ALCHEMY_GAS_POLICY_ID",
  "ALCHEMY_POLYGON_GAS_POLICY_ID",
  "ZERODEV_PROJECT_ID",
] as const;

let saved: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
  for (const name of ENV) delete process.env[name];
  resetAlchemyKeyBlocks();
  resetEvmReadState();
});

afterEach(() => {
  for (const name of ENV) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name] as string;
  }
  globalThis.fetch = realFetch;
});

/* ─── THE POOL ─────────────────────────────────────────────────────────────── */

test("a key is paired with the policy at ITS OWN index, never a neighbour's", () => {
  process.env.ALCHEMY_API_KEY = "k0,k1,k2";
  process.env.ALCHEMY_GAS_POLICY_ID = "p0,p1,p2";
  assert.deepEqual(
    alchemyPairs().map((pair) => [pair.key, pair.policyId]),
    [
      ["k0", "p0"],
      ["k1", "p1"],
      ["k2", "p2"],
    ]
  );
});

test("a blank slot keeps its place, so later keys are not shifted onto the wrong policy", () => {
  /*
    The whole reason blanks are written `",,"` rather than omitted. A Gas
    Manager policy belongs to the Alchemy app that created it, so a key sent
    with another index's policy is answered "Policy not found" — a shift here
    would silently disable sponsorship on every key after the gap.
  */
  process.env.ALCHEMY_API_KEY = "k0,k1,k2";
  process.env.ALCHEMY_GAS_POLICY_ID = ",p1,p2";
  const pairs = alchemyPairs();
  assert.equal(pairs[0].policyId, undefined, "k0 has no policy and must not borrow p1");
  assert.equal(pairs[1].policyId, "p1");
  assert.equal(pairs[2].policyId, "p2");
});

test("a key with no policy can still read, but is not offered for sponsorship", () => {
  process.env.ALCHEMY_API_KEY = "k0,k1";
  process.env.ALCHEMY_GAS_POLICY_ID = ",p1";
  const sponsoring = alchemyPairs().filter((pair) => Boolean(pair.policyId));
  assert.deepEqual(
    sponsoring.map((pair) => pair.key),
    ["k1"]
  );
  // But both are in the pool for an estimate or a receipt lookup.
  assert.equal(alchemyPairs().length, 2);
});

test("the deprecated FALLBACK key is appended after the list, and duplicates collapse", () => {
  process.env.ALCHEMY_API_KEY = "k0,k1";
  process.env.ALCHEMY_API_KEY_FALLBACK = "k9";
  // `alchemyKeys` is the pairs' keys, so the fallback is in both views —
  // there is no second list that could disagree with the pool about what is
  // configured.
  assert.deepEqual(alchemyKeys(), ["k0", "k1", "k9"]);
  assert.deepEqual(
    alchemyPairs().map((pair) => pair.key),
    ["k0", "k1", "k9"]
  );
  assert.equal(
    alchemyPairs()[2].policyId,
    undefined,
    "the fallback is appended past the policy list and can never sponsor"
  );

  // The same key twice is one key: walking it a second time would spend a
  // cooldown proving what the first walk already established.
  process.env.ALCHEMY_API_KEY_FALLBACK = "k0";
  assert.deepEqual(
    alchemyPairs().map((pair) => pair.key),
    ["k0", "k1"]
  );
});

test("a blocked key goes to the BACK of the order rather than disappearing", () => {
  /*
    Skipped, not removed. A cooldown is a guess that the key is still out; if
    every key is blocked the request must still be attempted against something
    rather than failing with "no keys", which would turn a throttle into an
    outage.
  */
  process.env.ALCHEMY_API_KEY = "k0,k1,k2";
  markAlchemyKeyBlocked("k0", MONTHLY_CAPACITY_COOLDOWN_MS);
  assert.equal(isAlchemyKeyBlocked("k0"), true);
  assert.deepEqual(alchemyKeysInOrder(), ["k1", "k2", "k0"]);

  markAlchemyKeyBlocked("k1", MONTHLY_CAPACITY_COOLDOWN_MS);
  markAlchemyKeyBlocked("k2", MONTHLY_CAPACITY_COOLDOWN_MS);
  assert.equal(alchemyKeysInOrder().length, 3, "all blocked still means all tried");
});

test("no key configured is told apart from a key without a policy", () => {
  assert.equal(hasAlchemyKey(), false);
  assert.deepEqual(alchemyPairs(), []);
  process.env.ALCHEMY_API_KEY = "k0";
  assert.equal(hasAlchemyKey(), true);
});

/* ─── THE REFUSAL THAT ARRIVES INSIDE A 200 ────────────────────────────────── */

test("Bundler Sponsored Operations reports being out of capacity INSIDE a 200", () => {
  /*
    The single subtlest rule here. A status check alone would read "Monthly
    capacity limit exceeded" as a successful sponsorship and hand the reader a
    userOperation nobody paid for.
  */
  const capacity = JSON.stringify({ error: { message: "Monthly capacity limit exceeded" } });
  assert.equal(pairCannotServe(200, capacity), "capacity");
  assert.equal(pairCannotServe(429, capacity), "capacity");
});

test("a throttled or unauthenticated pair is skipped; a real answer is passed through", () => {
  assert.equal(pairCannotServe(429, "{}"), "rejected");
  assert.equal(pairCannotServe(401, "{}"), "rejected");
  assert.equal(pairCannotServe(403, "{}"), "rejected");
  assert.equal(
    pairCannotServe(200, JSON.stringify({ error: { message: "Policy not found" } })),
    "rejected",
    "a policy that belongs to another app is this pair's problem, not the request's"
  );

  // Not this pair's fault — the same request would fail on every key, so
  // walking the pool would spend it all to learn nothing.
  assert.equal(pairCannotServe(200, JSON.stringify({ result: "0xabc" })), null);
  assert.equal(pairCannotServe(400, "bad request"), null);
  assert.equal(
    pairCannotServe(200, JSON.stringify({ error: { message: "execution reverted" } })),
    null
  );
});

/* ─── THE READ PATH ────────────────────────────────────────────────────────── */

const CALLS = [{ method: "eth_blockNumber", params: [] }];

function stubFetch(handler: (url: string) => { status: number; body: unknown }) {
  const seen: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    seen.push(url);
    const { status, body } = handler(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return seen;
}

test("reads go to ZeroDev first, so a throttled Alchemy key cannot break them", async () => {
  process.env.ZERODEV_PROJECT_ID = "a".repeat(24);
  process.env.ALCHEMY_API_KEY = "k0";
  const seen = stubFetch(() => ({ status: 200, body: [{ id: 1, result: "0x1" }] }));

  const out = await readEvm("base-mainnet", 8453, CALLS);
  assert.deepEqual(out, [{ id: 1, result: "0x1" }]);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /rpc\.zerodev\.app/u, "Alchemy must not be touched when ZeroDev answers");
});

test("a chain ZeroDev does not serve falls to Alchemy and is not asked again", async () => {
  process.env.ZERODEV_PROJECT_ID = "a".repeat(24);
  process.env.ALCHEMY_API_KEY = "k0";
  const seen = stubFetch((url) =>
    url.includes("zerodev")
      ? { status: 400, body: "No API provider supports the requested chainId" }
      : { status: 200, body: [{ id: 1, result: "0x2" }] }
  );

  assert.deepEqual(await readEvm("base-mainnet", 8453, CALLS), [{ id: 1, result: "0x2" }]);
  assert.equal(seen.filter((url) => url.includes("zerodev")).length, 1);

  // The refusal is remembered, so the next read does not pay for it again.
  await readEvm("base-mainnet", 8453, CALLS);
  assert.equal(
    seen.filter((url) => url.includes("zerodev")).length,
    1,
    "a chain ZeroDev cannot serve must be skipped for its cooldown"
  );
});

test("with no ZeroDev project the read still works, straight from the Alchemy pool", async () => {
  process.env.ALCHEMY_API_KEY = "k0";
  const seen = stubFetch(() => ({ status: 200, body: [{ id: 1, result: "0x3" }] }));

  assert.deepEqual(await readEvm("base-mainnet", 8453, CALLS), [{ id: 1, result: "0x3" }]);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /alchemy\.com/u);
});

test("no provider at all is an error, not an empty answer dressed as a result", async () => {
  // An empty envelope list would be read by viem as "this address has no
  // code" or "your balance is zero" — a wrong answer is worse than a failure.
  await assert.rejects(() => readEvm("base-mainnet", 8453, CALLS), /No read provider/u);
});

test("envelopes come back in the ORDER THE CALLS WERE MADE, whatever the provider does", async () => {
  /*
    JSON-RPC lets a server answer a batch in any order. Returning them as they
    arrived would pair each answer with the wrong call — a balance read
    answered with a nonce.
  */
  process.env.ALCHEMY_API_KEY = "k0";
  stubFetch(() => ({
    status: 200,
    body: [
      { id: 2, result: "second" },
      { id: 1, result: "first" },
    ],
  }));

  const out = await readEvm("base-mainnet", 8453, [
    { method: "eth_blockNumber", params: [] },
    { method: "eth_gasPrice", params: [] },
  ]);
  assert.deepEqual(
    out.map((envelope) => envelope.result),
    ["first", "second"]
  );
});
