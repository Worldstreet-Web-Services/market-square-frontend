/**
 * The server's published tipping rules, applied BEFORE the reader commits.
 *
 * `GET /tips/capability` answers `{ enabled, minKash, maxKash,
 * verifiedAuthorsOnly }` and the client never read it. In production that
 * answer is `min 1`, `max 10000`, `verifiedAuthorsOnly: true` — while the
 * sheet defaulted to **0.05 KASH** and offered a gift tray whose eight
 * cheapest tiles all sit under a whole KASH. So the most natural thing a
 * reader could do — open the sheet, tap the rose, send — was refused by the
 * service every time, after the confirm step, with a generic failure.
 *
 * The rule this encodes: an interface must not offer what the service will
 * refuse. The amounts, the recipients and the whole control are checked
 * against the capability the server publishes, so a tip that cannot succeed is
 * never presented as one that can.
 *
 * Pure, and pinned by `lib/tip-capability.test.ts`. `lib/tips.ts` stays the
 * SYNTAX of an amount (is it a decimal, how many places); this is the server's
 * POLICY on top of it, and the two are separate because only one of them
 * changes when the backend changes its mind.
 */

import type { TipCapability } from "@/lib/api/schemas";

/** Only the field the recipient rule reads. Structural, so tests need no fixture. */
export interface TipRecipient {
  verification?: string | null;
}

export type TipBlock =
  /** The service has tipping switched off entirely. */
  | "disabled"
  /** This account may not receive tips — it is not verified. */
  | "unverified-recipient";

/**
 * Why this tip cannot be offered, or null when it can.
 *
 * A MISSING capability answers null — permissive on purpose. The capability
 * read can fail or still be in flight, and hiding every tip control because a
 * lookup has not come back yet would break tipping to fix a message. The
 * service refuses what it must; this only stops us advertising a refusal.
 */
export function tipBlockedBecause(
  capability: TipCapability | null | undefined,
  recipient: TipRecipient | null | undefined
): TipBlock | null {
  if (!capability) return null;
  if (!capability.enabled) return "disabled";
  if (!capability.verifiedAuthorsOnly) return null;
  // `verified` ONLY. `lapsed` is a verified account whose payment ran out and
  // it must not be treated as verified anywhere (CLAUDE.md), least of all
  // where money is about to move.
  return recipient?.verification === "verified" ? null : "unverified-recipient";
}

/** What to tell the reader. Written for the person, never naming the field. */
export function tipBlockedMessage(block: TipBlock): string {
  switch (block) {
    case "disabled":
      return "Tipping isn't switched on yet.";
    case "unverified-recipient":
      return "This account can't receive tips yet — only verified creators can.";
  }
}

export type TipBoundsError = "below-min" | "above-max";

/**
 * Is a syntactically valid amount within the server's bounds?
 *
 * Compared as decimal strings scaled to a common width — never as floats,
 * because this is money and `0.1` is not `0.1`. An unreadable bound is
 * ignored rather than guessed: a capability payload we cannot parse must not
 * silently forbid every amount.
 */
export function tipAmountOutOfBounds(
  amountKash: string,
  capability: TipCapability | null | undefined
): TipBoundsError | null {
  if (!capability) return null;
  if (compareDecimals(amountKash, capability.minKash) === -1) return "below-min";
  if (compareDecimals(amountKash, capability.maxKash) === 1) return "above-max";
  return null;
}

const DECIMAL = /^(\d+)(?:\.(\d*))?$/u;

/** -1 / 0 / 1, or null when either side is not a plain decimal. */
function compareDecimals(a: string, b: string): -1 | 0 | 1 | null {
  const left = DECIMAL.exec(a.trim());
  const right = DECIMAL.exec(b.trim());
  if (!left || !right) return null;
  const width = Math.max((left[2] ?? "").length, (right[2] ?? "").length);
  const scale = (m: RegExpExecArray) => BigInt(m[1] + (m[2] ?? "").padEnd(width, "0"));
  const l = scale(left);
  const r = scale(right);
  if (l < r) return -1;
  return l > r ? 1 : 0;
}

/** Copy for a bound the reader has crossed, naming the actual limit. */
export function tipBoundsMessage(error: TipBoundsError, capability: TipCapability): string {
  return error === "below-min"
    ? `The smallest tip is ${capability.minKash} KASH.`
    : `The largest tip is ${capability.maxKash} KASH.`;
}

/**
 * Can this exact amount be sent right now?
 *
 * The one call a surface needs before enabling a commit control: it folds the
 * recipient rule and the bounds together so no caller can remember one and
 * forget the other.
 */
export function canSendTip(
  amountKash: string,
  capability: TipCapability | null | undefined,
  recipient: TipRecipient | null | undefined
): boolean {
  return (
    tipBlockedBecause(capability, recipient) === null &&
    tipAmountOutOfBounds(amountKash, capability) === null
  );
}
