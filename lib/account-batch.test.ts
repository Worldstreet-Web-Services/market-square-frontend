import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFunctionData, parseAbi } from "viem";
import { encodeErc20Transfer, toBaseUnits } from "./erc20.ts";
import { KASH_TOKEN_DECIMALS } from "./kash-amount.ts";
import { encodeExecuteBatch, splitTransferCalls } from "./account-batch.ts";

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

const BATCH_ABI = parseAbi([
  "function executeBatch(address[] dest, uint256[] value, bytes[] func)",
]);
const TRANSFER_ABI = parseAbi(["function transfer(address to, uint256 amount)"]);

/** What the account will actually do, read back out of the calldata. */
function decodeBatch(data: `0x${string}`) {
  const { functionName, args } = decodeFunctionData({ abi: BATCH_ABI, data });
  assert.equal(functionName, "executeBatch");
  const [dest, value, func] = args as [readonly string[], readonly bigint[], readonly `0x${string}`[]];
  return dest.map((to, i) => {
    const inner = decodeFunctionData({ abi: TRANSFER_ABI, data: func[i] });
    const [recipient, amount] = inner.args as [string, bigint];
    return { to, value: value[i], recipient, amount };
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
