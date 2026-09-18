/**
 * WHO THE FRIENDS DECK STILL HAS A QUESTION ABOUT.
 *
 * The deck exists to ask one thing — do you want to know this person? — so
 * anybody the reader has already answered for is not a candidate:
 *
 *   · somebody they FOLLOW (the service leaves them out with
 *     `excludeFollowing`; this covers a page fetched before the follow);
 *   · somebody they have WINKED at, which is the positive answer. QA,
 *     2026-09-18: "after I wink positively dont show me the same account
 *     again".
 *
 * "Again" lasts as long as the wink does — `WINK_COOLDOWN_MS`, the day the
 * wink control stays disabled for and the day the service's own
 * `excludeWinked` leaves them out (ogazboiz chose the lapse over a permanent
 * hide, 2026-09-18). A wink that went unanswered for a day is a question
 * again, and a deck that never re-asks runs out of people.
 *
 * ─── WHAT COUNTS AS "ALREADY WINKED" ─────────────────────────────────────────
 * `winkedByMe` is the service's own answer and outranks everything: it
 * survives a new browser, where this tab's memory does not. It is optional and
 * is NEVER defaulted — `undefined` means "this payload carries no wink edge",
 * not "no wink" — so the local record of winks sent from this browser
 * (`features/profile/lib/wink-store`) stands in when it is absent, and adds
 * the wink just sent before any list refetches.
 *
 * Pure, so `lib/deck-candidates.test.ts` pins it.
 */

export interface DeckCandidate {
  id: string;
  isFollowing?: boolean;
  winkedByMe?: boolean;
}

export function deckCandidates<T extends DeckCandidate>(
  people: readonly T[],
  input: {
    /** The reader, who is never a candidate for their own deck. */
    viewerId: string | null | undefined;
    /** Ids winked from this browser and still inside the cooldown. */
    winkedHere: (id: string) => boolean;
    /** False only where the reader deliberately widened the deck to everyone. */
    hideFollowed: boolean;
  }
): T[] {
  return people.filter((person) => {
    if (input.viewerId && person.id === input.viewerId) return false;
    if (input.hideFollowed && person.isFollowing === true) return false;
    if (person.winkedByMe === true) return false;
    return !input.winkedHere(person.id);
  });
}
