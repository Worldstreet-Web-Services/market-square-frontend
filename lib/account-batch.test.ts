import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFunctionData, parseAbi } from "viem";
import { encodeErc20Transfer, toBaseUnits } from "./erc20.ts";
import { KASH_TOKEN_DECIMALS } from "./kash-amount.ts";
import { encodeExecuteBatch, splitTransferCalls, transferCallsForLegs } from "./account-batch.ts";

/*
  PAYING THE CREATOR IN THE SAME TRANSACTION THAT TAKES THE FEE.

  Two separate transfers would mean the money RESTS at the platform between
  them — a float, a liability, and a payout somebody has to sign. One batch
  means it never stops, the creator is paid at the moment of the gift, and the
  treasury holds only Square's earnings.

  These test the calldata rather than a mock: what a batch actually decodes to
  is the only thing the account will act on.
*/

const TOKEN = "0xdf6FD1F6C28e5C08Eb41bD4C8733E394b28680D5" as const;
const CREATOR = "0x1111111111111111111111111111111111111111" as const;
const TREASURY = "0x0B51864341d548958c8dbB79b5c29e3E79e155ad" as const;

/*
  THE ABI THE DEPLOYED ACCOUNT EXPOSES — a struct array, not three parallel
  arrays. Read out of `0xe6cae83bde06e4c305530e199d7217f42808555b`, the
  implementation our 7702 accounts delegate to: `34fcd5be` present,
  `47e1da2a` absent.
*/
const BATCH_ABI = parseAbi([
  "struct Call { address target; uint256 value; bytes data; }",
  "function executeBatch(Call[] calls)",
]);
const TRANSFER_ABI = parseAbi(["function transfer(address to, uint256 amount)"]);

/** What the account will actually do, read back out of the calldata. */
function decodeBatch(data: `0x${string}`) {
  const { functionName, args } = decodeFunctionData({ abi: BATCH_ABI, data });
  assert.equal(functionName, "executeBatch");
  const [calls] = args as [readonly { target: string; value: bigint; data: `0x${string}` }[]];
  return calls.map((call) => {
    const inner = decodeFunctionData({ abi: TRANSFER_ABI, data: call.data });
    const [recipient, amount] = inner.args as [string, bigint];
    return { to: call.target, value: call.value, recipient, amount };
  });
}

const split = (total: string, share: string) =>
  splitTransferCalls({
    token: TOKEN,
    recipient: CREATOR,
    treasury: TREASURY,
    total: toBaseUnits(total, KASH_TOKEN_DECIMALS),
    recipientShare: toBaseUnits(share, KASH_TOKEN_DECIMALS),
    encodeTransfer: encodeErc20Transfer,
  });

test("a lion pays the creator and takes the fee, in one transaction", () => {
  // 1000 coins = 1 KASH, half to the creator. The numbers ogazboiz will watch.
  const legs = decodeBatch(encodeExecuteBatch(split("1", "0.5")));
  assert.equal(legs.length, 2);

  // THE CREATOR IS PAID FIRST. Atomic, so the order cannot change who gets
  // paid — but if a person ever reads this batch, the first thing it says is
  // that the creator was paid. The fee is what is left over.
  assert.equal(legs[0].recipient.toLowerCase(), CREATOR.toLowerCase());
  assert.equal(legs[0].amount, toBaseUnits("0.5", KASH_TOKEN_DECIMALS));
  assert.equal(legs[1].recipient.toLowerCase(), TREASURY.toLowerCase());
  assert.equal(legs[1].amount, toBaseUnits("0.5", KASH_TOKEN_DECIMALS));

  // Both legs call the TOKEN, and neither moves native value.
  for (const leg of legs) {
    assert.equal(leg.to.toLowerCase(), TOKEN.toLowerCase());
    assert.equal(leg.value, 0n);
  }
});

test("the two legs always sum to the price — no dust invented or lost", () => {
  /*
    The fee is the REMAINDER, never a second calculation. Two independently
    derived shares are exactly how a payment comes to move more or less than
    its price, and the client must not hold the percentage at all: it is
    configurable server-side, so a client that knew it would be wrong the day
    somebody changed it.

    Checked across the whole ladder, including the sub-unit rungs where a
    halving is least comfortable.
  */
  const rungs: Array<[string, string]> = [
    ["0.01", "0.005"], // rose — the cheapest, and the one that shows rounding first
    ["0.02", "0.01"],
    ["0.15", "0.075"],
    ["1", "0.5"], // lion
    ["50", "25"], // the kash coin
  ];
  for (const [total, share] of rungs) {
    const legs = decodeBatch(encodeExecuteBatch(split(total, share)));
    const moved = legs.reduce((sum, leg) => sum + leg.amount, 0n);
    assert.equal(
      moved,
      toBaseUnits(total, KASH_TOKEN_DECIMALS),
      `${total} KASH: the batch moved ${moved}, which is not the price`
    );
  }
});

test("a zero share writes no leg, because a transfer of nothing is gas for nothing", () => {
  // 100% to the creator: no fee exists, so no fee leg.
  const all = decodeBatch(encodeExecuteBatch(split("1", "1")));
  assert.equal(all.length, 1);
  assert.equal(all[0].recipient.toLowerCase(), CREATOR.toLowerCase());

  // 0% to the creator: the whole price is the fee. Real at a 0 percent share,
  // which the service allows.
  const none = decodeBatch(encodeExecuteBatch(split("1", "0")));
  assert.equal(none.length, 1);
  assert.equal(none[0].recipient.toLowerCase(), TREASURY.toLowerCase());
});

test("a share outside the price is refused, not clamped", () => {
  // Not a rounding question — a wrong number. Paying it would move money the
  // sender never agreed to, and clamping would hide which side was wrong.
  assert.throws(() => split("1", "1.5"), /not within/u);
  assert.throws(
    () =>
      splitTransferCalls({
        token: TOKEN,
        recipient: CREATOR,
        treasury: TREASURY,
        total: 100n,
        recipientShare: -1n,
        encodeTransfer: encodeErc20Transfer,
      }),
    /not within/u
  );
});

test("an empty batch is refused, and so is a bad address", () => {
  // `executeBatch([])` spends gas and does nothing; a caller reaching it has a
  // bug worth surfacing rather than a no-op worth tolerating.
  assert.throws(() => encodeExecuteBatch([]), /empty batch/u);
  assert.throws(
    () => encodeExecuteBatch([{ to: "0xnope" as `0x${string}`, data: "0x" }]),
    /not an EVM address/u
  );
});

/*
  THE LEGS THE SERVICE NAMES — the contract in service ADR #314.

  A LIST with roles rather than two named fields, because the split is
  configurable: at a 100% share the platform leg is simply absent, and a third
  leg could exist later without changing the shape.
*/

const toBase = (amount: string) => toBaseUnits(amount, KASH_TOKEN_DECIMALS);
const fromLegs = (total: string, legs: Array<{ toWallet: string; amountKash: string }>) =>
  transferCallsForLegs({
    token: TOKEN,
    legs,
    totalKash: total,
    toBase,
    encodeTransfer: encodeErc20Transfer,
  });

test("a lion's legs become one batch that pays both", () => {
  const legs = decodeBatch(
    encodeExecuteBatch(
      fromLegs("1", [
        { toWallet: CREATOR, amountKash: "0.5" },
        { toWallet: TREASURY, amountKash: "0.5" },
      ])
    )
  );
  assert.equal(legs.length, 2);
  assert.equal(legs[0].recipient.toLowerCase(), CREATOR.toLowerCase());
  assert.equal(legs[0].amount, toBase("0.5"));
  assert.equal(legs[1].recipient.toLowerCase(), TREASURY.toLowerCase());
});

test("legs that do not sum to the price are REFUSED, never adjusted", () => {
  /*
    The service asserts this and so does the client, because the client is what
    SIGNS. A signature is the last point at which the sender's agreement is
    still revocable — if the legs do not add up to what they were shown, the
    honest act is to refuse rather than to send and reconcile afterwards. Money
    that has moved cannot be un-agreed.

    Which side is wrong is not knowable from here, so neither is trusted.
  */
  assert.throws(
    () =>
      fromLegs("1", [
        { toWallet: CREATOR, amountKash: "0.5" },
        { toWallet: TREASURY, amountKash: "0.4" }, // 0.1 short
      ]),
    /but the gift costs/u
  );
  assert.throws(
    () =>
      fromLegs("1", [
        { toWallet: CREATOR, amountKash: "0.5" },
        { toWallet: TREASURY, amountKash: "0.6" }, // 0.1 over
      ]),
    /but the gift costs/u
  );
});

test("`0.5` and `0.50` are the same amount, because the check is in base units", () => {
  // Compared as decimal TEXT these differ and the send would be refused for a
  // split that is exactly right.
  const calls = fromLegs("1.00", [
    { toWallet: CREATOR, amountKash: "0.50" },
    { toWallet: TREASURY, amountKash: "0.5" },
  ]);
  assert.equal(calls.length, 2);
});

test("a 100% share sends ONE leg, which is the shape the service promises", () => {
  // At 100% the platform leg is absent from the response entirely — not
  // present as a zero — so the batch is a single transfer.
  const calls = fromLegs("1", [{ toWallet: CREATOR, amountKash: "1" }]);
  assert.equal(calls.length, 1);

  // And a zero leg that did arrive writes no call: a transfer of nothing is
  // gas spent to move nothing.
  const withZero = fromLegs("1", [
    { toWallet: CREATOR, amountKash: "1" },
    { toWallet: TREASURY, amountKash: "0" },
  ]);
  assert.equal(withZero.length, 1);
});

test("the whole ladder splits and sums, including the sub-unit rungs", () => {
  for (const [total, share] of [
    ["0.01", "0.005"],
    ["0.02", "0.01"],
    ["0.15", "0.075"],
    ["1", "0.5"],
    ["50", "25"],
  ] as const) {
    const fee = (Number(total) - Number(share)).toFixed(8).replace(/0+$/u, "").replace(/\.$/u, "");
    const legs = decodeBatch(
      encodeExecuteBatch(
        fromLegs(total, [
          { toWallet: CREATOR, amountKash: share },
          { toWallet: TREASURY, amountKash: fee },
        ])
      )
    );
    const moved = legs.reduce((sum, leg) => sum + leg.amount, 0n);
    assert.equal(moved, toBase(total), `${total} KASH moved ${moved}`);
  }
});

test("a bad wallet in a leg is refused rather than encoded", () => {
  assert.throws(
    () =>
      fromLegs("1", [
        { toWallet: "0xnope", amountKash: "0.5" },
        { toWallet: TREASURY, amountKash: "0.5" },
      ]),
    /not an EVM address/u
  );
});


/*
  THE SELECTOR IS PART OF THE CONTRACT.

  The previous encoder used `executeBatch(address[],uint256[],bytes[])`, on
  the authority of a comment. The deployed implementation does not have that
  function — and an absent selector does not revert, it falls through to the
  account's fallback, which succeeds and executes nothing.

  So every split gift reported success, moved no KASH, and burned ~82k gas
  doing nothing. A comment cannot check a deployed contract. This can.
*/
test("the batch calls the function the deployed account actually has", () => {
  const data = encodeExecuteBatch(split("1", "0.5"));
  assert.equal(
    data.slice(0, 10),
    "0x34fcd5be",
    "executeBatch((address,uint256,bytes)[]) — the struct form the implementation exposes"
  );
  assert.notEqual(
    data.slice(0, 10),
    "0x47e1da2a",
    "the three-array form is ABSENT from the account and silently does nothing"
  );
});
