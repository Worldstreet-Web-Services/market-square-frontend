/**
 * PEOPLE THIS READER HAS ALREADY DECIDED ABOUT.
 *
 * The deck asks one question — do you want to know this person? — and it was
 * only remembering two of the three possible answers, and only for a day.
 * ogazboiz, 2026-09-20: "if you have dislike person they should not be able to
 * see that card, or if they follow then why am I seeing the card again".
 *
 * ─── WHAT EVERY DATING APP DOES, AND WHY ─────────────────────────────────────
 * Tinder, Hinge and Bumble all store the SWIPE, not just the match. Every card
 * is a decision row, and the queue is built by the server from "everyone minus
 * everyone I have decided about". That is why you never see the same face
 * twice, and why their undo is a paid feature rather than the default — a
 * decision you can accidentally repeat is not a decision.
 *
 * We had the opposite: a follow and a wink were remembered by the SERVICE
 * (`excludeFollowing`, `excludeWinked`), and a pass — the commonest answer of
 * the three — was remembered nowhere at all. The deck's own comment admitted
 * it: "Left tells the service nothing: there is no dismiss-a-person route."
 *
 * ─── SO THIS IS THE THIRD ANSWER, AND THE OTHER TWO MADE PERMANENT ───────────
 * A decision here is FINAL for the deck. That is deliberately stricter than
 * the wink cooldown, which is a rule about sending a second wink (a day) and
 * not about how long a card stays answered. The two were conflated, and the
 * result was somebody's face coming back a day after they had been winked at.
 *
 * ─── AND IT IS A BRIDGE, NOT THE ANSWER ──────────────────────────────────────
 * This is one device. A pass recorded here does not follow the reader to their
 * phone, and a cleared browser forgets it. The service must carry passes the
 * way it already carries winks — asked for, and until it lands this keeps the
 * promise on the device where the swipe happened. The moment it does, this
 * shrinks back to what the wink store is: the bridge between the tap and the
 * next refetch.
 *
 * Pure, so `lib/deck-decisions.test.ts` pins it.
 */

/** What the reader answered. */
export type DeckDecision = "passed" | "winked" | "followed";

export interface DecisionRecord {
  targetId: string;
  decision: DeckDecision;
  at: number;
}

/**
 * How many decisions are kept per device.
 *
 * Large enough that nobody reaches it by swiping, small enough that
 * localStorage is never the reason a browser struggles. Oldest go first — the
 * service is what makes the older ones stick, and a reader who has swiped
 * through two thousand people has long since stopped being the case this
 * bridge exists for.
 */
export const DECISIONS_KEPT = 2_000;

/**
 * Record one decision, newest last, one row per person.
 *
 * A later decision REPLACES an earlier one about the same person: pass then
 * follow is a follow, and keeping both would make "have I decided?" depend on
 * which row was read first. Returns a new array — the caller's may be shared.
 */
export function recordDecision(
  decisions: readonly DecisionRecord[],
  targetId: string,
  decision: DeckDecision,
  now: number
): DecisionRecord[] {
  const without = decisions.filter((row) => row.targetId !== targetId);
  const next = [...without, { targetId, decision, at: now }];
  return next.length > DECISIONS_KEPT ? next.slice(next.length - DECISIONS_KEPT) : next;
}

/** Has this reader answered for this person, whatever the answer was? */
export function decided(decisions: readonly DecisionRecord[], targetId: string): boolean {
  return decisions.some((row) => row.targetId === targetId);
}

/** What they answered, or null. For a surface that wants to say which. */
export function decisionFor(
  decisions: readonly DecisionRecord[],
  targetId: string
): DeckDecision | null {
  // Last write wins, which is what `recordDecision` maintains anyway.
  for (let index = decisions.length - 1; index >= 0; index -= 1) {
    const row = decisions[index]!;
    if (row.targetId === targetId) return row.decision;
  }
  return null;
}

/** Only the ids, for a filter that does not care which answer it was. */
export function decidedIds(decisions: readonly DecisionRecord[]): Set<string> {
  return new Set(decisions.map((row) => row.targetId));
}
