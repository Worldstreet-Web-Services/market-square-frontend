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
  /** Only people the viewer does not follow yet. */
  newOnly: boolean;
}

export const EMPTY_FRIENDS_FILTER: FriendsFilter = { city: "", gender: "", newOnly: false };

/** Is anything narrowed at all? Decides whether an empty deck is "nobody" or "nobody matching". */
export function isFriendsFilterActive(filter: FriendsFilter): boolean {
  return filter.city.trim() !== "" || filter.gender.trim() !== "" || filter.newOnly;
}

/** How many clauses are on. */
export function friendsFilterCount(filter: FriendsFilter): number {
  return (filter.city.trim() ? 1 : 0) + (filter.gender.trim() ? 1 : 0) + (filter.newOnly ? 1 : 0);
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
  return "New people";
}

/** The query facets `usePeople` sends — trimmed, and only the clauses that are on. */
export function friendsFilterFacets(filter: FriendsFilter): {
  city?: string;
  gender?: string;
  excludeFollowing?: boolean;
} {
  const city = filter.city.trim();
  const gender = filter.gender.trim();
  return {
    ...(city ? { city } : {}),
    ...(gender ? { gender } : {}),
    ...(filter.newOnly ? { excludeFollowing: true } : {}),
  };
}
