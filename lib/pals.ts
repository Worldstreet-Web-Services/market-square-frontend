/**
 * WHO IS ACTUALLY A PAL.
 *
 * A follow is about CONTENT — "I want your posts". A pal is about a PERSON.
 * Someone you follow who has never followed you back is an audience
 * relationship, not a friendship, and putting them on the people page is why
 * /pals reads as Home with different SQL: follow one loud stranger and they
 * colonise the surface that is supposed to be your people.
 *
 * So a pal is a MUTUAL follow. That is not a new rule — it is the one the
 * product already ships: `lib/friends-popup.ts` resolves a follow-back to the
 * moment kind "friends" and ranks it ABOVE "mutual-wink". Defining it any
 * other way would put two meanings of the same word in one codebase.
 *
 * A WINK IS NOT THE RELATION, deliberately. It is unsolicited, rate-limited,
 * and it EXPIRES — the service stores `(sender, recipient, created_at)` with
 * no answered column, and "active" is computed against a 24-hour cutoff. A
 * relation built on it would evaporate overnight. The product treats the wink
 * as a doorbell rather than a bond: the mutual-wink moment's own button says
 * "Follow back". The wink's job is to produce the follow that makes a pal.
 *
 * Pure, so the rule can be read and tested without a browser.
 */

/**
 * The people in `following` who follow the reader back, in the order the
 * server returned them.
 *
 * ORDER IS THE SERVER'S. `GET /profiles/:id/following` is already ranked, and
 * re-sorting one loaded page is not sorting the list — the same reason the
 * people directory leaves `sort` to the service.
 */
export function mutualPals<T extends { id: string }>(
  following: readonly T[],
  followers: readonly { id: string }[]
): T[] {
  const followsBack = new Set(followers.map((person) => person.id));
  return following.filter((person) => followsBack.has(person.id));
}

/**
 * Is this list still growing?
 *
 * An intersection of two PAGED lists is only complete when both are. A pal
 * whose follow-back sits on page two of the followers list is missed until
 * that page arrives, so a caller that stops early under-reports — and under a
 * label like "Your pals" an under-report reads as "they unfollowed me".
 */
export function palsArePartial(followingDone: boolean, followersDone: boolean): boolean {
  return !(followingDone && followersDone);
}
