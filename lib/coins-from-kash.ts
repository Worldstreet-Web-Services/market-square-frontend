/**
 * COINS ARE A DENOMINATION OF KASH, NOT A BALANCE ANYBODY HOLDS.
 *
 * ogazboiz, 2026-09-25: *"instead of buying, right, the kash will just do that
 * — so if you have kash it will just do the calculation that you have square
 * coin, and if they need more square coin they will need to have kash"*.
 *
 * So a coin balance is not a thing to be bought, credited, or waited on: it is
 * a VIEW of the KASH a reader already holds, at the service's own rate. The
 * gift tray keeps pricing in coins because that is what people read; KASH stays
 * the only thing anyone owns.
 *
 * This replaces a model where coins were bought with KASH and held as a stored
 * balance against a treasury float. That model is what produced the screen
 * ogazboiz was looking at: 0.11 KASH in the wallet and a coin balance reading
 * ZERO, because the purchase that would have credited it had no settlement
 * caller and never landed.
 *
 * ─── ROUNDED DOWN, ALWAYS ────────────────────────────────────────────────────
 * 0.0115 KASH is 11.5 coins and must read as ELEVEN. A coin shown is a coin
 * that can be spent, and rounding up would offer a twelfth that the send would
 * then refuse — the interface promising something the money cannot cover. The
 * same direction `exceedsBalance` already guards from the other side.
 *
 * Pure and alias-free, so `node --test` pins it.
 */

/** Digits only, no sign, at most this many decimal places. Matches the engine. */
const KASH_DECIMAL = /^(\d+)(?:\.(\d{1,18}))?$/u;

/**
 * How many whole coins a KASH balance is worth, or null when that cannot be
 * answered.
 *
 * NULL IS "NOT KNOWN", NEVER "NONE" — the rule every balance in this codebase
 * follows. A rate still loading, a balance still in flight, or an amount the
 * engine would not accept must not render as a confident `0 coins`: that is
 * the interface inventing a shortfall it cannot see, and it is exactly the
 * wrong answer for somebody who does have money.
 *
 * @param kash  the reader's KASH balance, as the engine's decimal string
 * @param rate  `coinsPerKash` from the gift catalogue — never hard-coded here,
 *              because a reprice must be one deploy and not two
 */
export function coinsFromKash(
  kash: string | null | undefined,
  rate: number | null | undefined
): number | null {
  if (typeof kash !== "string" || kash.trim() === "") return null;
  if (typeof rate !== "number" || !Number.isInteger(rate) || rate <= 0) return null;

  const parts = KASH_DECIMAL.exec(kash.trim());
  if (!parts) return null;

  /*
    Integer arithmetic on the DIGITS, never `Number(kash) * rate`. A float
    turns 0.29 KASH at 1000 into 289.99999999999994, which floors to 289 — a
    coin quietly missing from somebody's balance, and the kind of error that
    only shows up on the amounts real people hold.
  */
  const whole = BigInt(parts[1]);
  const frac = parts[2] ?? "";
  const scale = BigInt(10) ** BigInt(frac.length);
  const scaled = whole * scale + BigInt(frac === "" ? 0 : frac);

  const coins = (scaled * BigInt(rate)) / scale; // BigInt division truncates
  return coins > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(coins);
}
