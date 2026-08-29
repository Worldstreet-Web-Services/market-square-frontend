/**
 * The rule that stops somebody paying twice.
 *
 * Buying KASH through the engine is TWO steps that are not one transaction:
 * the buyer sends USDC on-chain, and then the engine is told to credit that
 * payment. Only the first moves money, and only the second produces anything
 * the buyer can see. So there is a window — a gateway timeout, a service
 * restart, a dropped connection — in which the money has genuinely left the
 * wallet and the credit has not happened.
 *
 * What the buyer does then is press the button again. If the settled payment
 * lived in a local variable, that press starts a SECOND payment: they have now
 * paid twice and hold one purchase. The fix is not a nicer error message, it
 * is that the receipt for a payment which already settled must survive the
 * failure of the credit, and the retry must credit THAT payment rather than
 * making another.
 *
 * This module is the decision half of that: what counts as the same attempt,
 * and when a held receipt may be reused. The component holds it in a ref (see
 * `features/kash/components/kash-buy-sheet.tsx`); the rule lives here so it can
 * be read and pinned on its own, because it is the one bug in this whole flow
 * that costs a real person real money.
 *
 * Pure and dependency-free — `lib/payment-hold.test.ts` runs it under
 * `node --test`.
 */

/** A payment that has been made and whose outcome is not yet resolved. */
export interface PaymentHold {
  /** The attempt it belongs to. See `holdKey`. */
  key: string;
  /** The settled transaction. The thing that must never be made twice. */
  txHash: string;
  /**
   * The order this payment belongs to, where there is one.
   *
   * A token buy pays into a deposit address minted by a quote, and the ORDER
   * ID is the only way back to it: lose that and the money is somewhere the
   * reader cannot see, with the interface offering to start again. So it is
   * held with the hash rather than beside it.
   */
  ref?: string;
  /** When it was recorded, epoch ms. See `HOLD_TTL_MS`. */
  createdAt: number;
}

/**
 * How long a held payment may be reused.
 *
 * A hold exists to rescue ONE interrupted attempt, and it is stored where a
 * page reload cannot destroy it — otherwise the buyer whose credit failed
 * refreshes, finds nothing held, and pays a second time, which is the exact
 * bug. But an unbounded hold has its own failure: if the credit actually
 * landed and only its response was lost, the hold survives with a hash the
 * engine has already settled. Reusing that a week later would answer a
 * genuinely new purchase with "already credited" and deliver nothing.
 *
 * An hour is far longer than any interrupted checkout and far shorter than
 * "later today", which puts the expiry firmly between the two failures. The
 * engine is the backstop in both directions: it refuses to settle one
 * transaction hash twice, so a stale reuse is a clear conflict rather than a
 * silent loss.
 */
export const HOLD_TTL_MS = 60 * 60 * 1000;

const DECIMAL = /^(\d+)(?:\.(\d*))?$/u;

/**
 * Identity of one payment attempt: what it is for, and how much.
 *
 * The amount is CANONICALISED — `"10"`, `"10.0"` and `"010.00"` are the same
 * ten dollars and therefore the same attempt. wsws keys its equivalent on the
 * raw input string, which means a buyer whose credit failed and who then
 * retyped the same amount slightly differently gets a key that does not match
 * their held receipt, and pays a second time. The whole guard turns on this
 * comparison, so it compares VALUES rather than keystrokes.
 *
 * Null when the amount is not an amount — there is no attempt to identify, and
 * a key built from garbage would happily match another key built from
 * different garbage.
 */
export function holdKey(purpose: string, amount: string): string | null {
  const match = DECIMAL.exec(amount.trim());
  if (!match) return null;
  const [, whole = "", fraction = ""] = match;
  const canonical = `${whole.replace(/^0+(?=\d)/u, "")}.${fraction.replace(/0+$/u, "")}`;
  // "0." after canonicalisation is zero, which is not a payment.
  if (canonical === "0.") return null;
  return `${purpose}:${canonical}`;
}

/**
 * The transaction a retry must reuse, or null when this attempt has not
 * already been paid for.
 *
 * Deliberately exact-match. A held receipt for a DIFFERENT amount is not
 * reusable — changing the amount is a genuinely new purchase, and crediting an
 * old $10 payment against a new $50 one would short the buyer by forty
 * dollars. So the two failure directions are traded off explicitly: reusing
 * too eagerly under-charges, reusing too rarely double-charges, and the key is
 * what keeps both from happening.
 */
export function reusableHold(
  hold: PaymentHold | null,
  key: string | null,
  now: number = Date.now(),
  ttlMs: number = HOLD_TTL_MS
): PaymentHold | null {
  if (!hold || !key) return null;
  if (hold.key !== key) return null;
  // A hold from the future is a corrupted or hand-edited record, not a recent
  // one. Neither is worth reusing against somebody's money.
  const age = now - hold.createdAt;
  if (!Number.isFinite(age) || age < 0 || age > ttlMs) return null;
  return hold;
}

/**
 * A stored hold, validated.
 *
 * It comes back from session storage, which is to say from something a person
 * can edit. Everything is checked before any of it is allowed near a decision
 * about whether to send money.
 */
export function parseHold(raw: unknown): PaymentHold | null {
  if (!raw || typeof raw !== "object") return null;
  const { key, txHash, ref, createdAt } = raw as Record<string, unknown>;
  if (typeof key !== "string" || !key) return null;
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{2,}$/u.test(txHash)) return null;
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) return null;
  return { key, txHash, createdAt, ...(typeof ref === "string" && ref ? { ref } : {}) };
}

/**
 * A fresh idempotency key for one attempt.
 *
 * Minted where the user's INTENT begins — when the buy sheet opens on an
 * amount — and never inside the request. A key generated per request is a new
 * key on every retry, which is precisely the behaviour idempotency exists to
 * prevent: the service sees two unrelated requests and honours both.
 *
 * The generator is injected so the test can prove the id is taken from it
 * rather than being re-derived somewhere inside.
 */
export function newIntentId(
  purpose: string,
  uuid: () => string = () => globalThis.crypto.randomUUID()
): string {
  return `${purpose}-${uuid()}`;
}
