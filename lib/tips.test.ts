import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEFAULT_TIP_KASH,
  MAX_TIP_DECIMALS,
  TIP_PRESETS_KASH,
  acceptsTipKeystroke,
  isSameTipAmount,
  parseTipAmount,
  tipAmountMessage,
} from "./tips.ts";

test("every preset is itself a valid amount", () => {
  for (const preset of TIP_PRESETS_KASH) {
    const parsed = parseTipAmount(preset);
    assert.equal(parsed.ok, true, `${preset} should parse`);
    if (parsed.ok) assert.equal(parsed.amountKash, preset, "presets are already canonical");
  }
  assert.ok(TIP_PRESETS_KASH.includes(DEFAULT_TIP_KASH as (typeof TIP_PRESETS_KASH)[number]));
});

test("amounts are canonicalised as TEXT, never through a float", () => {
  const cases: Array<[string, string]> = [
    ["5", "5"],
    [" 5 ", "5"],
    ["05", "5"],
    ["0005", "5"],
    ["5.00", "5"],
    ["5.50", "5.5"],
    ["5.", "5"],
    ["0.10", "0.1"],
    ["0.01", "0.01"],
  ];
  for (const [input, expected] of cases) {
    const parsed = parseTipAmount(input);
    assert.equal(parsed.ok, true, `${input} should parse`);
    if (parsed.ok) assert.equal(parsed.amountKash, expected, `${input} → ${expected}`);
  }
});

test("a canonical amount is a string the backend can take verbatim", () => {
  // The guard that matters: no exponent, no comma, no sign, no trailing dot.
  for (const input of ["1", "0.01", "999999", "12.34"]) {
    const parsed = parseTipAmount(input);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.match(parsed.amountKash, /^\d+(\.\d+)?$/);
  }
});

test("zero in any spelling is refused", () => {
  for (const input of ["0", "0.0", "0.00", "00", "0."]) {
    assert.deepEqual(parseTipAmount(input), { ok: false, reason: "zero" });
  }
});

test("non-numeric input is refused rather than coerced", () => {
  for (const input of ["-5", "abc", "1e3", "1,000", "5 KASH", "+5", ".5", "1.2.3", "Infinity", "NaN"]) {
    const parsed = parseTipAmount(input);
    assert.equal(parsed.ok, false, `${input} must not parse`);
    if (!parsed.ok) assert.equal(parsed.reason, "not-a-number");
  }
});

test("empty is its own reason, so the sheet can stay quiet before typing", () => {
  assert.deepEqual(parseTipAmount(""), { ok: false, reason: "empty" });
  assert.deepEqual(parseTipAmount("   "), { ok: false, reason: "empty" });
});

test("over-precise amounts are refused, never rounded", () => {
  // Rounding 1.239 down to 1.23 would send a different sum of money than the
  // one the person read on screen.
  assert.deepEqual(parseTipAmount("1.239"), { ok: false, reason: "too-precise" });
  assert.equal(parseTipAmount(`1.${"0".repeat(MAX_TIP_DECIMALS + 1)}`).ok, false);
  assert.equal(parseTipAmount("1.99").ok, true);
});

test("absurd amounts are refused client-side; the server still owns the real cap", () => {
  assert.deepEqual(parseTipAmount("1000000"), { ok: false, reason: "too-large" });
  assert.equal(parseTipAmount("999999").ok, true);
  // Leading zeros do not count towards the digit budget.
  assert.equal(parseTipAmount("000999999").ok, true);
});

test("every failure reason has copy a person can act on", () => {
  for (const reason of ["empty", "not-a-number", "zero", "too-precise", "too-large"] as const) {
    const copy = tipAmountMessage(reason);
    assert.ok(copy.length > 0);
    assert.doesNotMatch(copy, /[A-Z]{2,}_[A-Z]{2,}/, "raw error codes never reach the screen");
  }
});

test("half-typed amounts are allowed on screen but not on the wire", () => {
  for (const partial of ["", "1", "1.", "1.2", "0", "0."]) {
    assert.equal(acceptsTipKeystroke(partial), true, `${partial} should be typeable`);
  }
  for (const blocked of ["-", "a", "1.234", "1e", "1,0", "1234567", "."]) {
    assert.equal(acceptsTipKeystroke(blocked), false, `${blocked} should be blocked`);
  }
  // ...and the ones that are typeable but not sendable still fail the parse.
  assert.equal(parseTipAmount("0.").ok, false);
});

test("preset selection compares canonical amounts", () => {
  assert.equal(isSameTipAmount("5", "5.00"), true);
  assert.equal(isSameTipAmount("05", "5"), true);
  assert.equal(isSameTipAmount("5", "50"), false);
  // An unparseable side is never "the same" as anything, including itself.
  assert.equal(isSameTipAmount("", ""), false);
  assert.equal(isSameTipAmount("abc", "abc"), false);
});

test("the earnings screen prints what was CREDITED, never the face value", () => {
  /*
    A GIFT'S RECEIVER IS NOT CREDITED WHAT THE ROOM SAW FLY. `amountKash` is
    the face value — a 1000-coin lion is 1 KASH — and Square keeps half of a
    gift, so the receiver gets 0.5. Print the face value and every gift receipt
    on the one screen people check before believing they earned something is
    overstated by double.

    IT WOULD HAVE BROKEN WITHOUT THIS FILE CHANGING. Today the two numbers are
    equal, because no split exists on a tip: the service writes the SAME
    `amountKash` to the sender's debit and the author's credit. The day the
    gift spend leg deploys, the same field on the same screen starts meaning
    something else. So this is pinned now, while it still passes trivially.

    The fallback is what makes it correct BEFORE the field exists rather than
    merely safe: `creditedKash` is optional with no default, and absent means
    a deployment with no split, where the face value IS the credit.
  */
  const earnings = readFileSync("components/layout/profile-earnings.tsx", "utf8");
  assert.match(earnings, /const earnedKash = creditedKash \?\? amountKash;/);
  assert.match(earnings, /\{formatKash\(earnedKash\)\}/);
  assert.doesNotMatch(
    earnings,
    /formatKash\(amountKash\)/,
    "the face value must never be printed as earnings"
  );

  // And the field has to survive the parse, or the fallback is all there is.
  const api = readFileSync("features/tips/lib/api.ts", "utf8");
  // NULLABLE as well as optional: the service's column is `string | null` and
  // a tip is always null there, so `.optional()` alone threw on the first
  // response that carried the field. Three states, no default — absent, null
  // and a value are three different facts, and the fallback to `amountKash` is
  // only correct while all three survive the parse. The null case and why it
  // matters are demonstrated in `lib/tip-capability.test.ts`.
  assert.match(api, /creditedKash: z\.string\(\)\.nullable\(\)\.optional\(\),/);
  assert.doesNotMatch(
    api,
    /creditedKash:.*\.default\(/,
    "a default would erase the difference between absent, null and equal"
  );
});
