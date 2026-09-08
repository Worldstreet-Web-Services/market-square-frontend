import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_PEOPLE_FILTER,
  activeFilterCount,
  facetValues,
  filterPeople,
  filterScopeNotes,
  isFiltering,
  matchesPeopleFilter,
  parsePeopleSort,
  toggleRole,
  type FilterablePerson,
} from "./people-filters.ts";

const person = (over: Partial<FilterablePerson> = {}): FilterablePerson => ({
  role: "citizen",
  verification: "none",
  ...over,
});

test("an empty filter never removes anybody", () => {
  // "No preference" and "matches nothing" must not be the same predicate —
  // this is the resting state of the page, and it lists everyone.
  const rows = [person(), person({ role: "creator" }), person({ verification: "verified" })];
  assert.deepEqual(filterPeople(rows, EMPTY_PEOPLE_FILTER), rows);
  assert.equal(isFiltering(EMPTY_PEOPLE_FILTER), false);
  assert.equal(activeFilterCount(EMPTY_PEOPLE_FILTER), 0);
});

test("role narrows to the selected roles, and selecting several widens", () => {
  const rows = [
    person({ role: "citizen" }),
    person({ role: "creator" }),
    person({ role: "ambassador" }),
  ];
  assert.deepEqual(filterPeople(rows, { ...EMPTY_PEOPLE_FILTER, roles: ["creator"] }), [rows[1]]);
  assert.deepEqual(
    filterPeople(rows, { ...EMPTY_PEOPLE_FILTER, roles: ["creator", "ambassador"] }),
    [rows[1], rows[2]]
  );
});

test("verified means verified — pending and lapsed are not", () => {
  // The check renders only on `verified`; a lapsed badge is history, not a
  // current signal, so it must not survive a "verified only" filter.
  const rows = [
    person({ verification: "verified" }),
    person({ verification: "pending" }),
    person({ verification: "lapsed" }),
    person({ verification: "none" }),
  ];
  assert.deepEqual(filterPeople(rows, { ...EMPTY_PEOPLE_FILTER, verifiedOnly: true }), [rows[0]]);
});

test("clauses combine with AND", () => {
  const rows = [
    person({ role: "creator", verification: "verified" }),
    person({ role: "creator", verification: "none" }),
    person({ role: "citizen", verification: "verified" }),
  ];
  assert.deepEqual(
    filterPeople(rows, { ...EMPTY_PEOPLE_FILTER, roles: ["creator"], verifiedOnly: true }),
    [rows[0]]
  );
});

test("location matches a substring of city or region, case-insensitively", () => {
  // The reader types "lagos"; the row says "Lagos, Nigeria".
  const lagos = person({ city: "Lagos", region: "Lagos State" });
  const leeds = person({ city: "Leeds", region: "West Yorkshire" });
  assert.equal(matchesPeopleFilter(lagos, { ...EMPTY_PEOPLE_FILTER, location: "lagos" }), true);
  assert.equal(matchesPeopleFilter(lagos, { ...EMPTY_PEOPLE_FILTER, location: "  LAGOS " }), true);
  assert.equal(matchesPeopleFilter(leeds, { ...EMPTY_PEOPLE_FILTER, location: "lagos" }), false);
  // The region alone is enough — somebody may name a region and not a city.
  assert.equal(
    matchesPeopleFilter(person({ region: "West Yorkshire" }), {
      ...EMPTY_PEOPLE_FILTER,
      location: "yorkshire",
    }),
    true
  );
});

test("a person with no place set is excluded by a location filter, not kept", () => {
  // Keeping them would make "people in Lagos" mean "people in Lagos, plus
  // everyone who never said" — which is not what the reader asked.
  assert.equal(
    matchesPeopleFilter(person(), { ...EMPTY_PEOPLE_FILTER, location: "lagos" }),
    false
  );
});

test("gender matches exactly, not as a substring", () => {
  // Substring matching on a self-declared word is how "man" swallows "woman".
  const woman = person({ gender: "Woman" });
  assert.equal(matchesPeopleFilter(woman, { ...EMPTY_PEOPLE_FILTER, gender: "woman" }), true);
  assert.equal(matchesPeopleFilter(woman, { ...EMPTY_PEOPLE_FILTER, gender: "man" }), false);
});




test("gender chips come from the values that actually arrived", () => {
  // No vocabulary is written down here: the service's values are the only
  // values, so nobody is dropped for answering something we did not list.
  const rows = [
    person({ gender: "Woman" }),
    person({ gender: "Man" }),
    person({ gender: "woman" }),
    person({ gender: "Non-binary" }),
    person(),
  ];
  assert.deepEqual(facetValues(rows, "gender"), ["Man", "Non-binary", "Woman"]);
  assert.deepEqual(facetValues([person()], "gender"), []);
});

test("toggling a role adds then removes it", () => {
  const once = toggleRole(EMPTY_PEOPLE_FILTER, "creator");
  assert.deepEqual(once.roles, ["creator"]);
  assert.deepEqual(toggleRole(once, "creator").roles, []);
});

test("the scope note fires only for the CLIENT-SIDE facets", () => {
  /*
    Role and Verified have no parameter on GET /profiles, so they are matched
    over the pages loaded so far and the reader has to be told. Place and
    gender do have parameters — free text, matched server-side — so saying
    "these narrow the people already loaded" while one of THOSE is active would
    describe a limitation that does not apply to it.
  */
  assert.deepEqual(filterScopeNotes(EMPTY_PEOPLE_FILTER), []);
  assert.deepEqual(filterScopeNotes({ ...EMPTY_PEOPLE_FILTER, verifiedOnly: true }), [
    "Role and Verified narrow the people already loaded — keep scrolling for more.",
  ]);
  assert.deepEqual(filterScopeNotes({ ...EMPTY_PEOPLE_FILTER, roles: ["creator"] }), [
    "Role and Verified narrow the people already loaded — keep scrolling for more.",
  ]);
});

test("a server-side facet alone says nothing about loaded pages", () => {
  assert.deepEqual(filterScopeNotes({ ...EMPTY_PEOPLE_FILTER, location: "Lagos" }), []);
  assert.deepEqual(filterScopeNotes({ ...EMPTY_PEOPLE_FILTER, gender: "female" }), []);
});

test("no note ever claims the service lacks a field it has", () => {
  /*
    The sentence this replaced read "gender isn't on a profile yet, so the
    square can't narrow by it" — a claim about the SCHEMA inferred from whether
    the loaded rows carried a value. PublicProfile carries `gender` and
    /profiles accepts it, so that was telling readers the product lacked
    something it has.
  */
  const everything = {
    ...EMPTY_PEOPLE_FILTER,
    roles: ["creator"],
    verifiedOnly: true,
    location: "Lagos",
    gender: "female",
  };
  for (const note of filterScopeNotes(everything)) {
    assert.doesNotMatch(note, /isn't on a profile|aren't on a profile|can't narrow/);
  }
});

test("sort accepts only the two orderings the route documents", () => {
  assert.equal(parsePeopleSort("recent"), "recent");
  assert.equal(parsePeopleSort("followers"), "followers");
  // Anything else falls back rather than being sent upstream unchecked.
  assert.equal(parsePeopleSort("nearest"), "followers");
  assert.equal(parsePeopleSort(null), "followers");
});

test("filtering does not mutate the cached page it was handed", () => {
  const original = [person({ role: "creator" }), person({ role: "citizen" })];
  const copy = [...original];
  filterPeople(original, { ...EMPTY_PEOPLE_FILTER, roles: ["creator"] });
  assert.deepEqual(original, copy);
});
