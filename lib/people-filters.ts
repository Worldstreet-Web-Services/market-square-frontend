/**
 * Explore's people filters: what the square can honestly narrow a person by.
 *
 * ─── THE CONTRACT, CHECKED FIRST ─────────────────────────────────────────────
 * `GET /profiles` (api.tsionark.com and localhost:8080, identical documents)
 * accepts exactly four parameters: `q`, `sort` (`followers` | `recent`),
 * `cursor`, `limit`. `PublicProfile` carries: id, username, displayName, bio,
 * avatarUrl, role, verification, orgBadge, followerCount, followingCount,
 * isFollowing.
 *
 * There is NO location field, NO gender field, and no query parameter for
 * either. So the honest split is:
 *
 *   SERVER-SIDE, real   `q` (free text) and `sort` — the directory route owns
 *                       both, and a paged list is never re-sorted here.
 *   CLIENT-SIDE, real   role and verification — both are on every row, so the
 *                       predicate below is true filtering, but only over the
 *                       PAGES ALREADY LOADED. Say so at the call site; a
 *                       reader who thinks they filtered the whole directory
 *                       and got four people has been misled.
 *   NOT SHIPPED         location and gender. They are not rendered as
 *                       controls, because a control that cannot act is worse
 *                       than an admitted gap — it teaches the reader the
 *                       square has no women in Lagos when it has never been
 *                       asked. `facetAvailability` decides that at RUNTIME
 *                       from the data, so the day the backend adds the fields
 *                       the controls appear with no code change here.
 *
 * WHAT THE BACKEND NEEDS, precisely:
 *   1. `PublicProfile.city: string | null` and `PublicProfile.region: string
 *      | null` — free text the person typed, self-declared, editable, and
 *      omittable. Add them to `UpdateMeRequest` too or they can never be set.
 *   2. `PublicProfile.gender: string | null` — self-declared free text or a
 *      vocabulary the service owns. This module never hardcodes a list; the
 *      chips are built from the values that actually arrive (`facetValues`),
 *      so the service's vocabulary is the only vocabulary.
 *   3. `GET /profiles?city=&region=&gender=` — matching the loaded page is a
 *      stopgap. Filtering 30 rows of a directory is not filtering a directory,
 *      and no cursor can top a filtered page back up.
 *
 * ─── AND WHAT IT MUST NOT SHIP ───────────────────────────────────────────────
 * NO latitude, NO longitude, NO radius, NO distance-to-this-person. There is
 * deliberately no field for one in `PersonFacets`, so a backend that started
 * sending coordinates would have nowhere to put them and nothing here would
 * render them. City or region is a place a person chose to name; a distance is
 * a stranger's position, refreshed, and it is how this class of product gets
 * people hurt. This is a hard line, not a phase-one simplification.
 */

/** A profile row, as far as filtering is concerned. */
export interface FilterablePerson {
  role: string;
  verification: string;
  /** Self-declared place name. City or region ONLY — never a coordinate. */
  city?: string | null;
  region?: string | null;
  /** Self-declared, in whatever vocabulary the service owns. */
  gender?: string | null;
}

export type PeopleFacet = "role" | "verified" | "location" | "gender";

export interface PeopleFilter {
  /** Empty means "anyone". Values are `PublicProfile.role` strings. */
  roles: string[];
  verifiedOnly: boolean;
  /** Free text, matched against city AND region. Empty means "anywhere". */
  location: string;
  /** Exact value from the service's own vocabulary. Empty means "anyone". */
  gender: string;
}

export const EMPTY_PEOPLE_FILTER: PeopleFilter = {
  roles: [],
  verifiedOnly: false,
  location: "",
  gender: "",
};

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

/**
 * Which facets the loaded rows can actually answer.
 *
 * Derived from the DATA, not from a feature flag, so this file never has to be
 * edited again when the backend catches up: the first payload carrying a
 * `city` turns the location control on by itself. Role and verification are on
 * every row by contract, so they are always available — including for an empty
 * list, where hiding the controls would make an empty result look like a
 * broken page rather than an empty one.
 */
export function facetAvailability(people: FilterablePerson[]): Record<PeopleFacet, boolean> {
  return {
    role: true,
    verified: true,
    location: people.some((person) => norm(person.city) !== "" || norm(person.region) !== ""),
    gender: people.some((person) => norm(person.gender) !== ""),
  };
}

/**
 * The distinct values present for a facet, sorted, for building chips.
 *
 * Gender chips are built from this rather than from a list written here. A
 * hardcoded vocabulary in the client is a second source of truth for something
 * the service and the person describing themselves own between them, and it
 * would silently drop anyone whose answer is not on our list.
 */
export function facetValues(people: FilterablePerson[], facet: "gender"): string[] {
  const seen = new Map<string, string>();
  for (const person of people) {
    const raw = (person[facet] ?? "").trim();
    if (raw && !seen.has(raw.toLowerCase())) seen.set(raw.toLowerCase(), raw);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Does one person survive the filter?
 *
 * Location matches a SUBSTRING of city or region, because the reader types
 * "lagos" and the row says "Lagos, Nigeria". An empty clause never excludes —
 * "no preference" and "matches nothing" must not be the same predicate.
 */
export function matchesPeopleFilter(person: FilterablePerson, filter: PeopleFilter): boolean {
  if (filter.roles.length > 0 && !filter.roles.includes(person.role)) return false;
  if (filter.verifiedOnly && person.verification !== "verified") return false;

  const location = norm(filter.location);
  if (location) {
    const place = `${norm(person.city)} ${norm(person.region)}`.trim();
    if (!place.includes(location)) return false;
  }

  const gender = norm(filter.gender);
  if (gender && norm(person.gender) !== gender) return false;

  return true;
}

/** The loaded rows that survive. Order is preserved — the server ranked it. */
export function filterPeople<T extends FilterablePerson>(
  people: T[],
  filter: PeopleFilter
): T[] {
  if (!isFiltering(filter)) return people;
  return people.filter((person) => matchesPeopleFilter(person, filter));
}

/** Is anything actually narrowed? Used to decide whether to explain the scope. */
export function isFiltering(filter: PeopleFilter): boolean {
  return (
    filter.roles.length > 0 ||
    filter.verifiedOnly ||
    filter.location.trim() !== "" ||
    filter.gender.trim() !== ""
  );
}

/** How many clauses are on, for the count beside a collapsed filter control. */
export function activeFilterCount(filter: PeopleFilter): number {
  return (
    (filter.roles.length > 0 ? 1 : 0) +
    (filter.verifiedOnly ? 1 : 0) +
    (filter.location.trim() ? 1 : 0) +
    (filter.gender.trim() ? 1 : 0)
  );
}

/** Toggle one role in the set. Selecting nothing means "anyone", not "nobody". */
export function toggleRole(filter: PeopleFilter, role: string): PeopleFilter {
  const roles = filter.roles.includes(role)
    ? filter.roles.filter((entry) => entry !== role)
    : [...filter.roles, role];
  return { ...filter, roles };
}

/**
 * The sentence under the controls.
 *
 * Two separate admissions, and neither may be dropped for being wordy:
 *   - what there is nothing to narrow BY, named so the reader does not go
 *     looking for a control that is not there
 *   - that what we CAN filter by only sees the pages loaded so far
 * Returns the parts rather than a formatted string so the caller can style the
 * two halves; an empty array means there is nothing to admit.
 *
 * ─── IT SPEAKS ABOUT THE DATA, NOT ABOUT THE SERVICE ────────────────────────
 * It used to read "gender isn't on a profile yet, so the square can't narrow by
 * it" — a claim about the SCHEMA, drawn from an observation about VALUES.
 * `facetAvailability` can only see whether the loaded rows carry a gender, and
 * "nobody has filled this in" is a completely different fact from "the service
 * has no such field".
 *
 * That distinction stopped being academic: `PublicProfile` now carries `gender`
 * and `GET /profiles` accepts it as a facet — checked against the live contract
 * — so the sentence was telling readers the product lacked something it has,
 * on the evidence that the handful of people loaded had not answered it.
 *
 * So it says the observable thing instead, which stays true either way.
 */
export function filterScopeNotes(
  available: Record<PeopleFacet, boolean>,
  filter: PeopleFilter
): string[] {
  const notes: string[] = [];
  const missing = [
    available.location ? null : "a location",
    available.gender ? null : "a gender",
  ].filter(Boolean) as string[];
  if (missing.length > 0) {
    notes.push(
      `Nobody loaded here has added ${missing.join(" or ")} yet, so there's nothing to narrow by.`
    );
  }
  if (isFiltering(filter)) {
    notes.push("These narrow the people already loaded — keep scrolling for more.");
  }
  return notes;
}

/** The two orderings `GET /profiles` documents. Never a client-side re-sort. */
export const PEOPLE_SORTS = ["followers", "recent"] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];

export function parsePeopleSort(raw: string | null | undefined): PeopleSort {
  return (PEOPLE_SORTS as readonly string[]).includes(raw ?? "")
    ? (raw as PeopleSort)
    : "followers";
}
