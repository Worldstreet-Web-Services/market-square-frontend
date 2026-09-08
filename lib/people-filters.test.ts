import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMPTY_PEOPLE_FILTER,
  activeFilterCount,
  facetAvailability,
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

test("facet availability is read from the data, not from a flag", () => {
  // Today's PublicProfile carries neither field, so both are unavailable and
  // the controls are not rendered at all. The day a payload carries a city,
  // this turns the control on with no code change.
  const today = [person(), person({ role: "creator" })];
  assert.deepEqual(facetAvailability(today), {
    role: true,
    verified: true,
    location: false,
    gender: false,
  });

  const tomorrow = [person({ city: "Lagos" }), person({ gender: "Woman" })];
  assert.deepEqual(facetAvailability(tomorrow), {
    role: true,
    verified: true,
    location: true,
    gender: true,
  });
});

test("blank strings do not count as a facet arriving", () => {
  // A backend that adds the column and sends "" for everyone has not shipped
  // the feature, and an empty control would be worse than none.
  assert.equal(facetAvailability([person({ city: "  ", region: "", gender: "" })]).location, false);
  assert.equal(facetAvailability([person({ gender: "  " })]).gender, false);
});

test("role and verification stay available for an empty list", () => {
  // Hiding the controls when nothing loaded would make an empty result look
  // like a broken page rather than an empty one.
  assert.equal(facetAvailability([]).role, true);
  assert.equal(facetAvailability([]).verified, true);
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

test("the scope note names what is missing and that filtering is page-scoped", () => {
  const none = { role: true, verified: true, location: false, gender: false };
  assert.deepEqual(filterScopeNotes(none, EMPTY_PEOPLE_FILTER), [
    "Nobody loaded here has added a location or a gender yet, so there's nothing to narrow by.",
  ]);
  assert.deepEqual(filterScopeNotes(none, { ...EMPTY_PEOPLE_FILTER, verifiedOnly: true }), [
    "Nobody loaded here has added a location or a gender yet, so there's nothing to narrow by.",
    "These narrow the people already loaded — keep scrolling for more.",
  ]);
});

test("the missing-facet note disappears when the backend ships the fields", () => {
  const all = { role: true, verified: true, location: true, gender: true };
  assert.deepEqual(filterScopeNotes(all, EMPTY_PEOPLE_FILTER), []);
  assert.deepEqual(filterScopeNotes(all, { ...EMPTY_PEOPLE_FILTER, location: "Lagos" }), [
    "These narrow the people already loaded — keep scrolling for more.",
  ]);
});

test("one missing facet reads as singular", () => {
  const half = { role: true, verified: true, location: true, gender: false };
  assert.deepEqual(filterScopeNotes(half, EMPTY_PEOPLE_FILTER), [
    "Nobody loaded here has added a gender yet, so there's nothing to narrow by.",
  ]);
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
