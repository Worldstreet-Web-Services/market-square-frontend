/**
 * Explore's people filters: what the square can honestly narrow a person by.
 *
 * ─── THE CONTRACT, CHECKED FIRST ─────────────────────────────────────────────
 * `GET /profiles` (api.tsionark.com and localhost:8080, identical documents)
 * accepts TEN parameters, verified against the served spec on 2026-09-13:
 * `q`, `sort`, `city`, `region`, `country`, `gender`, `excludeFollowing`,
 * `withMutualFollowers`, `cursor`, `limit`.
 *
 * THIS BLOCK USED TO SAY THE OPPOSITE — "there is NO location field, NO gender
 * field, and no query parameter for either" — while contradicting itself ten
 * lines later, where it correctly described `city`, `region` and `gender` as
 * server-side. Both halves could not be true, and the false half was read as
 * the truth: it is why somebody reported to ogazboiz that the gender filter
 * only narrowed a loaded page. It does not. The route has always answered it.
 * A stale comment that is wrong about a CONTRACT is worse than no comment,
 * because the next reader trusts it instead of the spec.
 *
 * So the honest split is:
 *
 *   SERVER-SIDE, real   `q` (free text) and `sort` — the directory route owns
 *                       both, and a paged list is never re-sorted here.
 *   CLIENT-SIDE, real   role and verification — both are on every row, so the
 *                       predicate below is true filtering, but only over the
 *                       PAGES ALREADY LOADED. Say so at the call site; a
 *                       reader who thinks they filtered the whole directory
 *                       and got four people has been misled.
 *   SERVER-SIDE         location and gender, and `q`. `GET /profiles` takes
 *                       `city`, `region` and `gender` as FREE TEXT, matched
 *                       case-insensitively and exactly, composing with each
 *                       other. They were once gated on a loaded profile
 *                       carrying the value, which hid them exactly when the
 *                       square was young and told a reader who wanted people
 *                       in Lagos that it could not narrow by place — never
 *                       true of the route. Their fields are always offered.
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
 * ONE admission now, not two, and the one that went is the interesting part.
 *
 * It used to lead with what could not be filtered at all — "gender isn't on a
 * profile yet, so the square can't narrow by it" — a claim about the SCHEMA
 * drawn from an observation about VALUES: it could only see whether the loaded
 * rows carried a gender, and "nobody has filled this in" is a different fact
 * from "the service has no such field".
 *
 * Both are now moot: `city`, `region` and `gender` are real parameters on
 * `GET /profiles` — free text, matched case-insensitively and exactly — so
 * place and gender are narrowed by the SERVICE and their controls are always
 * offered. There is nothing left to apologise for on that front.
 *
 * What remains true is that ROLE and VERIFIED are matched here, over the pages
 * loaded so far, because the route has no parameter for either. So the note
 * fires for those and only those: saying "these narrow the people already
 * loaded" while the active filter is a server-side one would be describing a
 * limitation that does not apply to it.
 */
export function filterScopeNotes(filter: PeopleFilter): string[] {
  const clientSide = filter.roles.length > 0 || filter.verifiedOnly;
  return clientSide
    ? ["Role and Verified narrow the people already loaded — keep scrolling for more."]
    : [];
}

/**
 * The orderings `GET /profiles` documents. Never a client-side re-sort.
 *
 * `foryou` is the DECK's ordering and nothing else's. A directory search is
 * fairly answered by popularity; a deck is not — sorted by follower count,
 * every reader in a city opens Square and meets the same twenty accounts in
 * the same order, those twenty are buried in winks and nobody else is ever
 * seen. It is the failure mode every dating app designed its way out of, and
 * ranking is the service's job: reciprocity first (people who winked you),
 * then people who know your people, then place, then freshness, shuffled
 * within each band by a seed that is stable for one reader for one day.
 */
export const PEOPLE_SORTS = ["followers", "recent", "foryou"] as const;
export type PeopleSort = (typeof PEOPLE_SORTS)[number];

/**
 * What the deck asks for, kept in ONE place so it can be switched in one line.
 *
 * STILL `followers` UNTIL THE SERVICE THAT ACCEPTS `foryou` IS DEPLOYED.
 * Verified against production on 2026-09-20: `?sort=foryou` answers 400
 * VALIDATION_ERROR, "expected one of followers|recent".
 *
 * The asymmetry is the whole point. An unknown PARAMETER is ignored, which is
 * what makes `excludePassed` and `excludeWinkedEver` safe to send before the
 * service has them. An unknown SORT VALUE is a refusal, and a refused query is
 * an empty deck on Home and on /pals — so this one cannot go early.
 *
 * It flips in one line the day wsws-monorepo #267 deploys. Every ranking
 * change BEHIND the value still lands with no frontend release; only the
 * switch to it has to wait for the service.
 */
export const DECK_SORT: PeopleSort = "followers";

export function parsePeopleSort(raw: string | null | undefined): PeopleSort {
  return (PEOPLE_SORTS as readonly string[]).includes(raw ?? "")
    ? (raw as PeopleSort)
    : "followers";
}
