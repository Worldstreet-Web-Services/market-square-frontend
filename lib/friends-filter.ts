/**
 * The "Make some friends" filter — what the deck can honestly narrow by.
 *
 * Three clauses, and every one is answered by the SERVICE, never by trimming a
 * loaded page: `GET /profiles` takes `city` and `gender` as free text matched
 * case-insensitively and exactly, and `excludeFollowing` for "not somebody I
 * already follow" (`features/discovery/hooks/use-discovery.ts`). The menu's
 * three rows — Location, Friends, Gender — map onto those three parameters
 * and nothing else; a row the route cannot back is not offered.
 *
 * A place, never a distance. `city` is a name the person published about
 * themselves; there is no radius and no coordinate here, and there must not
 * be — see `lib/people-filters.ts` for why that is a hard line.
 */
export interface FriendsFilter {
  /** Exact city, as the service matches it. Empty means "anywhere". */
  city: string;
  /** "male" or "female" (`lib/gender.ts`). Empty means "anyone". */
  gender: string;
  /**
   * Only people the viewer does not follow yet — the deck's DEFAULT.
   *
   * A deck for making friends that deals people you already follow is asking
   * a question you have answered (ogazboiz, 2026-09-18: "once they have
   * follow someone why am i still seeing them in that wink card"). The
   * service does the narrowing (`GET /profiles?excludeFollowing=1`), so the
   * cursor pages a list that never contained them rather than a page with
   * holes cut in it. "Everyone" in the menu turns it off, and THAT is the
   * deliberate choice the pill then names.
   */
  newOnly: boolean;
}

export const EMPTY_FRIENDS_FILTER: FriendsFilter = { city: "", gender: "", newOnly: true };

/** Is anything narrowed at all? Decides whether an empty deck is "nobody" or "nobody matching". */
export function isFriendsFilterActive(filter: FriendsFilter): boolean {
  // `newOnly` is the resting state, so it narrows nothing; choosing "Everyone"
  // WIDENS the deck, which is the deliberate choice worth naming.
  return filter.city.trim() !== "" || filter.gender.trim() !== "" || !filter.newOnly;
}

/** How many clauses are on. */
export function friendsFilterCount(filter: FriendsFilter): number {
  return (filter.city.trim() ? 1 : 0) + (filter.gender.trim() ? 1 : 0) + (filter.newOnly ? 0 : 1);
}

/**
 * The pill's label. The file writes "Location" on it, but the menu behind it
 * narrows by location, gender AND new people, so the resting label is
 * "Filter" (ogazboiz, 2026-09-12) — naming one of the three was telling the
 * reader the wrong thing about the other two. With ONE clause on, the pill
 * names the value, so the deck's narrowing is readable without opening the
 * menu. With more than one, a count — three values do not fit in 136px.
 */
export function friendsFilterLabel(filter: FriendsFilter): string {
  const count = friendsFilterCount(filter);
  if (count === 0) return "Filter";
  if (count > 1) return `${count} filters`;
  if (filter.city.trim()) return filter.city.trim();
  // Stored lowercase ("female"); shown as its label ("Female").
  if (filter.gender.trim()) {
    const gender = filter.gender.trim();
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }
  // The only single clause left that is not a value: the reader widened the
  // deck back to everyone, including the people they already follow.
  return "Everyone";
}

/** The query facets `usePeople` sends — trimmed, and only the clauses that are on. */
export function friendsFilterFacets(filter: FriendsFilter): {
  city?: string;
  gender?: string;
  excludeFollowing?: boolean;
  excludeWinked?: boolean;
} {
  const city = filter.city.trim();
  const gender = filter.gender.trim();
  return {
    ...(city ? { city } : {}),
    ...(gender ? { gender } : {}),
    ...(filter.newOnly ? { excludeFollowing: true } : {}),
    /*
      A WINK IS AN ANSWER, whichever way the deck is filtered — so this is not
      part of `newOnly`. The service drops anybody the reader has a standing
      wink at, which is what keeps the cursor exact and what carries the rule
      across devices; the client filter (lib/deck-candidates.ts) still covers
      the moment between a wink and the next read.
    */
    excludeWinked: true,
  };
}
