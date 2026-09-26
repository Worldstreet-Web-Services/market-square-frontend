import { encodeFunctionData, type Abi } from "viem";

/**
 * PAY TWO PEOPLE IN ONE TRANSACTION — the call that lets a gift settle without
 * the platform ever holding the money.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A gift is split: the recipient's share and Square's fee. Paid as two separate
 * transfers, the money has to REST somewhere between them — which means Square
 * holds a customer's funds, which means a float, a liability, and a payout
 * somebody has to sign. That is the shape ogazboiz rejected outright
 * ("i dont like that owe"), and it is what makes a creator's earnings a promise
 * rather than a payment.
 *
 * Paid as ONE batched call, the money never stops. The sender's own account
 * moves both legs atomically: the recipient is paid in the same transaction
 * that takes the fee, and the treasury becomes a FEE DESTINATION rather than a
 * float account — it holds only Square's earnings, never a customer's money.
 *
 * ─── WHY IT IS AVAILABLE AT ALL ──────────────────────────────────────────────
 * Every reader's embedded wallet is upgraded in place via EIP-7702 to the
 * shared SimpleAccount implementation, and the userOperation is gas-sponsored
 * (see `hooks/use-evm-send.ts`). SimpleAccount exposes `executeBatch`, so a
 * batch is a transaction the reader sends TO THEIR OWN ADDRESS carrying this
 * calldata. No new contract, no new key, no service-held signer.
 *
 * The delegation is at the SAME address, which is what makes this safe for
 * money: the balance that pays is the balance the reader can see.
 *
 * ─── ATOMIC IS THE POINT, NOT A BONUS ────────────────────────────────────────
 * Both legs land or neither does. A half-settled gift — the recipient paid and
 * the fee lost, or the fee taken and the recipient not paid — is the one state
 * worse than no gift at all, and a batch makes it unreachable rather than
 * merely unlikely.
 */

/**
 * `executeBatch((address target, uint256 value, bytes data)[] calls)` — the
 * ABI THE DEPLOYED ACCOUNT ACTUALLY EXPOSES.
 *
 * ─── THIS WAS THE THREE-ARRAY FORM, AND IT SILENTLY DID NOTHING ──────────────
 * It encoded `executeBatch(address[],uint256[],bytes[])`, selector `47e1da2a`,
 * on the authority of a comment saying that was what the implementation
 * exposed. After the move to Decane the account is delegated to
 * `0xe6cae83bde06e4c305530e199d7217f42808555b`, and reading that contract's
 * bytecode settles it:
 *
 *   34fcd5be  PRESENT  executeBatch((address,uint256,bytes)[])
 *   b61d27f6  PRESENT  execute(address,uint256,bytes)
 *   47e1da2a  ABSENT   executeBatch(address[],uint256[],bytes[])
 *
 * ─── AND AN ABSENT SELECTOR DOES NOT REVERT ──────────────────────────────────
 * That is the whole reason this hid. Calling a function an account does not
 * implement falls through to its FALLBACK, which returns successfully and
 * executes nothing. So every split gift produced:
 *
 *   tx status          SUCCESS
 *   UserOperationEvent success = true
 *   KASH transfers     ZERO
 *   gasUsed            ~82k, the cost of a fallback and nothing else
 *
 * A payment that reported success, moved no money, and left the sender's
 * balance untouched to the last digit — while the service held a txHash it
 * would wait on for ever, because the legs it needs to observe were never
 * transferred. Hours of hunting went past this, on both sides, because every
 * single signal said the send had worked.
 *
 * ─── SO THE SELECTOR IS PART OF THE CONTRACT, AND IT IS PINNED ───────────────
 * The old comment asserted the opposite of the truth and was believed. A
 * comment cannot check a deployed contract; the test beside this file does,
 * by asserting the encoded selector is `0x34fcd5be`. If the account
 * implementation changes again, that assertion is what fails — not a gift
 * that quietly moves nothing.
 */
const EXECUTE_BATCH_ABI = [
  {
    name: "executeBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [],
  },
] as const satisfies Abi;

/** One leg of a batch: a contract to call with this calldata. */
export interface BatchCall {
  to: `0x${string}`;
  data: `0x${string}`;
  /** Native value. Zero for an ERC-20 transfer, which is every call we make. */
  value?: bigint;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/u;

/**
 * Calldata for a batch of calls, to be sent to the sender's OWN account.
 *
 * Refuses an empty batch: `executeBatch([])` is a transaction that spends gas
 * and does nothing, and every caller reaching this with nothing to do has a
 * bug worth surfacing rather than a no-op worth tolerating.
 */
export function encodeExecuteBatch(calls: readonly BatchCall[]): `0x${string}` {
  if (calls.length === 0) throw new Error("an empty batch is not a transaction");
  for (const call of calls) {
    if (!EVM_ADDRESS.test(call.to)) throw new Error(`not an EVM address: ${call.to}`);
  }
  return encodeFunctionData({
    abi: EXECUTE_BATCH_ABI,
    functionName: "executeBatch",
    args: [calls.map((call) => ({ target: call.to, value: call.value ?? 0n, data: call.data }))],
  });
}

/**
 * THE TWO LEGS OF A SPLIT GIFT, in the order they are paid.
 *
 * ─── THE RECIPIENT IS FIRST, AND THAT IS DELIBERATE ──────────────────────────
 * The legs are atomic so the order cannot change who gets paid. It still
 * matters for the one thing an order CAN decide: if this batch is ever read by
 * a person — in a block explorer, in a support conversation, in a dispute —
 * the first thing it says is that the creator was paid. The fee is what is left
 * over, which is what a fee is.
 *
 * ─── THE FEE IS THE REMAINDER, NEVER A SECOND CALCULATION ────────────────────
 * `fee = total - recipient`, computed here from the two numbers the service
 * gave us, rather than derived from a percentage the client holds. Two
 * independently-derived shares are exactly how a payment comes to move more or
 * less than its price, and the client must not hold the rate at all: it is
 * configurable server-side, so a client that knew it would be wrong the day
 * somebody changed it.
 *
 * A zero share writes NO LEG. At 100% to the creator there is no fee to
 * transfer, and a transfer of nothing is gas spent to move nothing.
 */
export function splitTransferCalls(input: {
  /** The KASH token. */
  token: `0x${string}`;
  /** Where the creator's share goes. */
  recipient: `0x${string}`;
  /** Where the fee goes — Square's earnings, never a customer's money. */
  treasury: `0x${string}`;
  /** The whole price, in base units. */
  total: bigint;
  /** What the RECIPIENT gets, as the service computed it. */
  recipientShare: bigint;
  encodeTransfer: (to: string, amount: bigint) => `0x${string}`;
}): BatchCall[] {
  const { token, recipient, treasury, total, recipientShare, encodeTransfer } = input;
  if (recipientShare < 0n || recipientShare > total) {
    // A share outside the price is not a rounding question, it is a wrong
    // number — and paying it would move money the sender never agreed to.
    throw new Error(`share ${recipientShare} is not within ${total}`);
  }
  const fee = total - recipientShare;
  const calls: BatchCall[] = [];
  if (recipientShare > 0n) {
    calls.push({ to: token, data: encodeTransfer(recipient, recipientShare) });
  }
  if (fee > 0n) {
    calls.push({ to: token, data: encodeTransfer(treasury, fee) });
  }
  return calls;
}

/**
 * THE CALLS FOR A SPLIT THE SERVICE NAMED, and the check that it adds up.
 *
 * The service sends a LIST with roles rather than two fields, because the
 * split is configurable: at a 100% share the platform leg simply is not there,
 * and a third leg could exist later without changing this shape. So this maps
 * legs to calls and never assumes how many there are.
 *
 * ─── THE LEGS MUST SUM TO THE PRICE, AND IT IS CHECKED HERE ──────────────────
 * The service asserts it and so does this, because the client is what SIGNS.
 * A signature is the last place the sender's agreement is still revocable: if
 * the legs do not add up to what they were shown, the honest act is to refuse
 * rather than to send and reconcile afterwards. Money that has moved cannot be
 * un-agreed.
 *
 * Compared in base units, never as decimal strings — `0.5` and `0.50` are the
 * same amount and different text.
 *
 * A ZERO LEG WRITES NO CALL. A transfer of nothing is gas spent to move
 * nothing, and the service already drops a zero share rather than sending it —
 * this is the second half of the same rule, in case it ever does.
 */
export function transferCallsForLegs(input: {
  token: `0x${string}`;
  legs: readonly { toWallet: string; amountKash: string }[];
  /** The whole price the sender agreed to, as a decimal string. */
  totalKash: string;
  toBase: (amount: string) => bigint;
  encodeTransfer: (to: string, amount: bigint) => `0x${string}`;
}): BatchCall[] {
  const { token, legs, totalKash, toBase, encodeTransfer } = input;
  if (legs.length === 0) throw new Error("a split with no legs pays nobody");

  const total = toBase(totalKash);
  const sum = legs.reduce((running, leg) => running + toBase(leg.amountKash), 0n);
  if (sum !== total) {
    // Refused, not adjusted. Which side is wrong is not knowable from here, and
    // signing either would move money the sender never agreed to.
    throw new Error(`the split pays ${sum} but the gift costs ${total}`);
  }

  const calls: BatchCall[] = [];
  for (const leg of legs) {
    const amount = toBase(leg.amountKash);
    if (amount <= 0n) continue;
    if (!EVM_ADDRESS.test(leg.toWallet)) {
      throw new Error(`not an EVM address: ${leg.toWallet}`);
    }
    calls.push({ to: token, data: encodeTransfer(leg.toWallet, amount) });
  }
  if (calls.length === 0) throw new Error("every leg was zero");
  return calls;
}
