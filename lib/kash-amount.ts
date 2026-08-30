/**
 * KASH amounts, compared without ever becoming numbers.
 *
 * KASH is a decimal STRING end-to-end (CLAUDE.md), and the reason is not
 * stylistic: the engine stores balances as 6-decimal micro-units and rejects
 * JSON numbers outright, and a float cannot hold `0.1 + 0.2`. `lib/tips.ts`
 * already guards the amount a person TYPES; this guards the amounts the ENGINE
 * hands back, and compares one against the other.
 *
 * Everything here is text surgery and `BigInt`. No `Number()`, no
 * `parseFloat`, no arithmetic on a float anywhere — which is what lets a
 * balance of `0.000001` be compared exactly against a tip of `0.000002`
 * instead of both rounding into the same value.
 *
 * Pure and dependency-free so `node --test` can pin it: the only thing a
 * balance line can get catastrophically wrong is telling somebody they can
 * afford something they cannot, or the reverse.
 */

/**
 * The engine's own precision: 6 decimal places, matching the micro-units its
 * repository stores and the `fromMicro` it renders with. An amount with more
 * than this is not a KASH amount — it is a number that would be silently
 * truncated somewhere downstream, and truncating money without saying so is
 * the failure this whole module exists to avoid.
 */
export const KASH_DECIMALS = 6;

/**
 * The KSH ERC-20's OWN precision, which is not the API's.
 *
 * The engine speaks in 6 decimal places; the token on Base holds 18. A tip is
 * a transfer of that token, so an amount crossing from one to the other must
 * be re-scaled — sending `5` KASH as 5×10^6 instead of 5×10^18 moves a
 * trillionth of what the sender agreed to, and the transaction succeeds.
 *
 * Two constants rather than one, named for what each describes, so the two can
 * never be confused for a single "KASH precision".
 */
export const KASH_TOKEN_DECIMALS = 18;

/**
 * Digits, optionally one dot, optionally more digits. No sign, no exponent, no
 * separators — deliberately the same shape `lib/tips.ts` accepts, because an
 * amount that reached the wire as `1e3` or `1,000` would be read differently
 * by somebody, somewhere.
 */
const DECIMAL = /^(\d+)(?:\.(\d*))?$/u;

interface Parts {
  int: string;
  frac: string;
}

function split(raw: string): Parts | null {
  const match = DECIMAL.exec(raw.trim());
  if (!match) return null;
  const [, int = "", frac = ""] = match;
  if (frac.length > KASH_DECIMALS) return null;
  return { int, frac };
}

/** Is every digit a zero? Answered by inspection, never by `Number(x) === 0`. */
function isZero(parts: Parts): boolean {
  return !/[1-9]/u.test(parts.int) && !/[1-9]/u.test(parts.frac);
}

/**
 * Is this a KASH amount the engine would accept — a positive decimal with at
 * most 6 places?
 *
 * `"0"`, `"0.000000"` and `""` are all rejected: zero is a valid number and
 * not a valid amount, and the distinction is the whole point of asking.
 */
export function isKashAmount(raw: string): boolean {
  const parts = split(raw);
  return parts !== null && !isZero(parts);
}

/**
 * `-1` when `a < b`, `0` when equal, `1` when `a > b`, and `null` when either
 * side is not an amount at all.
 *
 * Null rather than a guess. A caller that cannot tell which is larger must be
 * able to say "I don't know" — see `exceedsBalance`, where the difference
 * between "you are short" and "I could not read your balance" is the
 * difference between a helpful warning and a false accusation.
 *
 * The comparison pads both fractions to the same width and compares the two as
 * single integers, so `"5"` and `"5.00"` are equal and `"10"` beats `"9.99"` —
 * which lexicographic string comparison gets wrong in both directions.
 */
export function compareKashAmounts(a: string, b: string): -1 | 0 | 1 | null {
  const left = split(a);
  const right = split(b);
  if (!left || !right) return null;
  const width = Math.max(left.frac.length, right.frac.length);
  const scaled = (parts: Parts) => BigInt(parts.int + parts.frac.padEnd(width, "0"));
  const l = scaled(left);
  const r = scaled(right);
  if (l < r) return -1;
  return l > r ? 1 : 0;
}

/**
 * Is `amount` more than `balance`?
 *
 * FALSE whenever either value is unreadable or missing, and that default is
 * deliberate. An unknown balance is not a zero balance: telling somebody "that
 * is more than you have" because a request had not landed yet would be the
 * interface inventing a shortfall, and the service is the only thing that can
 * actually refuse the spend. This warns; it never gates.
 */
export function exceedsBalance(
  amount: string | null | undefined,
  balance: string | null | undefined
): boolean {
  if (typeof amount !== "string" || typeof balance !== "string") return false;
  return compareKashAmounts(amount, balance) === 1;
}
