/**
 * Token amounts and ERC-20 calldata — the arithmetic that decides how much
 * money actually leaves a wallet.
 *
 * Every buy in this app is funded by one ERC-20 transfer of USDC on Base, and
 * the only thing standing between "spend $10" and "spend $10,000,000" is the
 * decimal-to-base-unit conversion below. So it is string surgery and `BigInt`,
 * never `Number`: `parseFloat("0.1") * 1e6` is `100000.00000000001`, and a
 * value that arrives at a contract with a fractional wei is not a value at all.
 *
 * The calldata encoder is hand-written rather than reached for through a
 * library. That is the same call `lib/server/proxy.ts` makes and for the same
 * reason: `lib/**` is dependency-free and alias-free so `node --test` can run
 * it with native type stripping, and a 68-byte payload with two fixed-width
 * fields is a thing you want pinned by tests you can read, not delegated. The
 * bytes are identical to what `viem`'s `encodeFunctionData` produces for the
 * same call — `lib/erc20.test.ts` pins the exact hex against a known vector.
 */

/** USDC has six decimals on every chain this app settles on. */
export const USDC_DECIMALS = 6;

/** `transfer(address,uint256)` — the first four bytes of its keccak hash. */
const TRANSFER_SELECTOR = "a9059cbb";

const DECIMAL = /^(\d+)(?:\.(\d*))?$/u;

/**
 * A decimal amount as integer base units.
 *
 * Throws rather than returning null, and deliberately so: every caller is
 * about to move money, and there is no sensible amount to fall back to. A
 * caller that wants a soft answer validates first (`isPayableAmount`).
 *
 * More precision than the token holds is a THROW, not a rounding. Silently
 * dropping a seventh decimal is silently changing the sum — and the direction
 * it rounds is not something the person authorising the payment agreed to.
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const match = DECIMAL.exec(amount.trim());
  if (!match) throw new Error(`not a decimal amount: ${amount}`);
  const [, whole = "0", fraction = ""] = match;
  if (fraction.length > decimals) {
    throw new Error(`at most ${decimals} decimals: ${amount}`);
  }
  return BigInt(whole + fraction.padEnd(decimals, "0"));
}

/** Base units back to a decimal string. Exact — no rounding in either place. */
export function fromBaseUnits(units: bigint, decimals: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/u, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function usdcToBaseUnits(amount: string): bigint {
  return toBaseUnits(amount, USDC_DECIMALS);
}

/**
 * A dollar figure for reading, rounded DOWN to cents.
 *
 * Down, never nearest. This renders as "you have $X" beside a control that
 * spends it, and rounding $4.999 up to $5.00 invites somebody to spend five
 * dollars they do not have and land on a revert.
 */
export function formatUsdc(units: bigint): string {
  const cents = units / 10_000n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

/**
 * Is this a payable amount — a positive decimal within the token's precision?
 *
 * The soft counterpart to `toBaseUnits`, for disabling a button rather than
 * throwing at one. Zero is not payable: a zero-value transfer is a real
 * transaction that costs real gas and buys nothing.
 */
export function isPayableAmount(amount: string, decimals: number = USDC_DECIMALS): boolean {
  const match = DECIMAL.exec(amount.trim());
  if (!match) return false;
  const [, whole = "", fraction = ""] = match;
  if (fraction.length > decimals) return false;
  return /[1-9]/u.test(whole) || /[1-9]/u.test(fraction);
}

/**
 * Calldata for `transfer(to, amount)`.
 *
 * Both arguments are padded to 32 bytes, which is the entire ABI encoding for
 * two static words — there is no dynamic data and no offset table. The
 * recipient is validated first: a malformed address padded into the slot would
 * produce a perfectly well-formed transaction that sends the money somewhere
 * nobody controls, and that failure is irreversible.
 *
 * A negative amount is refused for the same reason — it would wrap into an
 * enormous `uint256` rather than erroring.
 */
export function encodeErc20Transfer(to: string, amount: bigint): `0x${string}` {
  const recipient = to.trim().toLowerCase().replace(/^0x/u, "");
  if (!/^[0-9a-f]{40}$/u.test(recipient)) throw new Error(`not an EVM address: ${to}`);
  if (amount < 0n) throw new Error("amount must not be negative");
  const paddedTo = recipient.padStart(64, "0");
  const paddedAmount = amount.toString(16).padStart(64, "0");
  if (paddedAmount.length > 64) throw new Error("amount does not fit in uint256");
  return `0x${TRANSFER_SELECTOR}${paddedTo}${paddedAmount}`;
}
