/**
 * Tip amounts.
 *
 * KASH is a decimal STRING end-to-end (CLAUDE.md): the value the user picks is
 * the value that goes on the wire, character for character. Nothing here ever
 * does float arithmetic on an amount — no parseFloat, no Number(), no
 * multiplication. The functions below only ever *inspect and rewrite text*,
 * which is why a 20-decimal amount survives them unchanged instead of being
 * rounded into a different sum of money.
 *
 * Pure by design so `pnpm test` (node --test over lib/**) can pin it without a
 * renderer — the tip flow's only real correctness risk is the number.
 */

/**
 * The preset ladder.
 *
 * Deliberately the SAME ladder as the live-gift prices in
 * `features/streams/components/gift-sheet.tsx` (1 / 5 / 10 / 25 / 50 / 100).
 * Two different ladders for the two ways of handing someone KASH would teach
 * the reader that a "10" means something different in each place. If that
 * ladder ever moves, move this one with it.
 */
export const TIP_PRESETS_KASH = ["1", "5", "10", "25", "50", "100"] as const;

/** The default selection when the sheet opens — the second rung, not the first,
 *  so the common case is one tap and the cheapest option still needs a choice. */
export const DEFAULT_TIP_KASH = "5";

/**
 * Upper bound, as a digit count rather than a number.
 *
 * A tip is a gesture, not a transfer; six integer digits (999999 KASH) is far
 * past any plausible tip and still nowhere near a limit a real user meets. The
 * server owns the authoritative cap — this only stops the client sending
 * something obviously wrong, and it is expressed in digits precisely so that
 * checking it needs no numeric conversion.
 */
export const MAX_TIP_INT_DIGITS = 6;

/** Fractional precision the client will send. KASH's on-chain precision is the
 *  service's business; two places is what the composer offers, and anything
 *  longer is refused rather than silently rounded — rounding money down without
 *  telling anyone is how a tip quietly becomes a different tip. */
export const MAX_TIP_DECIMALS = 2;

export type TipAmountError =
  | "empty"
  | "not-a-number"
  | "zero"
  | "too-precise"
  | "too-large";

export type TipAmountResult =
  | { ok: true; amountKash: string }
  | { ok: false; reason: TipAmountError };

// Digits, optionally a single dot, optionally more digits. No sign, no
// exponent, no thousands separators — an amount that reached the wire as
// "1e3" or "1,000" would be interpreted by somebody, somewhere, differently.
const DECIMAL = /^(\d+)(?:\.(\d*))?$/;

/** Strip leading zeros from the integer part and trailing zeros from the
 *  fraction, without ever changing the value. Text surgery only. */
function canonicalise(int: string, frac: string): string {
  const whole = int.replace(/^0+(?=\d)/, "");
  const fraction = frac.replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

/**
 * Validate and canonicalise what the user typed into the amount the request
 * will carry. Returns the reason on failure so the sheet can say which rule
 * was broken instead of a generic "invalid".
 */
export function parseTipAmount(input: string): TipAmountResult {
  const raw = input.trim();
  if (!raw) return { ok: false, reason: "empty" };

  const match = DECIMAL.exec(raw);
  if (!match) return { ok: false, reason: "not-a-number" };

  const [, int, frac = ""] = match;
  if (frac.length > MAX_TIP_DECIMALS) return { ok: false, reason: "too-precise" };

  const amountKash = canonicalise(int, frac);
  // "0", "0.00" and "0." are all zero. After canonicalisation zero is exactly
  // the string "0", so this is one comparison rather than a numeric test.
  if (amountKash === "0") return { ok: false, reason: "zero" };
  if (amountKash.split(".")[0].length > MAX_TIP_INT_DIGITS)
    return { ok: false, reason: "too-large" };

  return { ok: true, amountKash };
}

/** Copy for each failure. Written for the person, not the validator. */
export function tipAmountMessage(reason: TipAmountError): string {
  switch (reason) {
    case "empty":
      return "Enter an amount.";
    case "not-a-number":
      return "Amounts are numbers only — like 5 or 2.50.";
    case "zero":
      return "A tip has to be more than zero.";
    case "too-precise":
      return `Up to ${MAX_TIP_DECIMALS} decimal places.`;
    case "too-large":
      return "That's larger than a tip — send it another way.";
  }
}

/**
 * Keystroke filter for the custom-amount field.
 *
 * Kept separate from `parseTipAmount` because a half-typed amount is not an
 * invalid one: "1." and "" are both legal things to have on screen mid-typing,
 * and rejecting them as you type makes the field feel broken. This only blocks
 * characters that can never appear in a KASH amount.
 */
export function acceptsTipKeystroke(next: string): boolean {
  if (next === "") return true;
  // At least one digit before the dot: a field showing a bare "." is not a
  // half-typed amount, it is a typo.
  if (!/^\d+(?:\.\d*)?$/.test(next)) return false;
  const [int, frac = ""] = next.split(".");
  return int.length <= MAX_TIP_INT_DIGITS && frac.length <= MAX_TIP_DECIMALS;
}

/**
 * Is this preset the currently chosen amount?
 *
 * Compares CANONICAL forms, so a custom "5.00" lights up the "5" chip rather
 * than leaving the sheet showing two different selections of the same money.
 */
export function isSameTipAmount(a: string, b: string): boolean {
  const left = parseTipAmount(a);
  const right = parseTipAmount(b);
  if (!left.ok || !right.ok) return false;
  return left.amountKash === right.amountKash;
}
