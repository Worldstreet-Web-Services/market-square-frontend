"use client";

import { cn } from "@/lib/cn";
import { IconWink } from "@/components/ui/icons";
import {
  PEOPLE_SORTS,
  facetAvailability,
  facetValues,
  filterScopeNotes,
  toggleRole,
  type PeopleFilter,
  type PeopleSort,
  type FilterablePerson,
} from "@/lib/people-filters";

/**
 * The controls above Explore's people directory.
 *
 * READ `lib/people-filters.ts` FIRST. It carries the contract check — which of
 * these the service can actually do, which are matched here over the loaded
 * pages, and exactly which fields the backend still owes — and this file only
 * draws what that module says is possible.
 *
 * THE RULE THIS SURFACE IS BUILT AROUND: nothing is drawn that cannot act. A
 * greyed-out "Location" chip is not honesty, it is an invitation to keep
 * tapping; and a chip that returns nothing is worse still, because a reader
 * who filters for women in Lagos and sees an empty list concludes there are
 * none rather than that nobody was ever asked. So the facets the payload
 * cannot answer are not controls at all — they are one sentence underneath,
 * saying so. `facetAvailability` decides that from the DATA, so the day
 * `PublicProfile` carries a city these appear on their own.
 *
 * SORT IS SERVER-SIDE and is a different kind of control from the rest, which
 * is why it is a segmented pair rather than another chip: re-sorting one
 * loaded page is not sorting a list, so the selection goes back to
 * `GET /profiles?sort=` and the cursor comes back in that order.
 *
 * TOKENS: the selected chip is the silver ramp — white ink, white hairline,
 * faint fill — like every other selection in the app. Purple is reserved here
 * for the wink, which is the one thing on this page that is not navigation.
 */

const SORT_LABEL: Record<PeopleSort, string> = {
  followers: "Most followed",
  recent: "Recently active",
};

/** Roles worth offering as a filter, with the service's own enum values. */
const ROLE_CHIPS: Array<{ role: string; label: string }> = [
  { role: "creator", label: "Creators" },
  { role: "ambassador", label: "Ambassadors" },
];

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "ws-press h-8 shrink-0 rounded-full border px-3 text-[12px] font-bold leading-4 transition-colors",
        selected
          ? "border-white/60 bg-white/10 text-white"
          : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/80"
      )}
    >
      {children}
    </button>
  );
}

export function PeopleFilters({
  people,
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: {
  /** The rows loaded so far — what the available facets are read from. */
  people: FilterablePerson[];
  filter: PeopleFilter;
  onFilterChange: (filter: PeopleFilter) => void;
  sort: PeopleSort;
  onSortChange: (sort: PeopleSort) => void;
}) {
  const available = facetAvailability(people);
  const genders = available.gender ? facetValues(people, "gender") : [];
  const notes = filterScopeNotes(available, filter);

  return (
    <div className="border-b border-white/8 px-4 pb-3 pt-1">
      {/* The line that says what this surface is FOR. Explore opens here, and
          a directory with no sentence over it reads as a search result for a
          query nobody typed. */}
      <p className="flex items-center gap-1.5 pb-2.5 text-[12px] leading-4 text-meta">
        <IconWink className="h-3.5 w-3.5 shrink-0 text-create" />
        People on the square. Wink to let someone know you&apos;re interested.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {/* Server-side ordering, as a segmented pair — see the header. */}
        <div
          role="group"
          aria-label="Order people by"
          className="flex h-8 shrink-0 items-center rounded-full border border-white/15 p-0.5"
        >
          {PEOPLE_SORTS.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={sort === entry}
              onClick={() => onSortChange(entry)}
              className={cn(
                "ws-press h-7 rounded-full px-3 text-[12px] font-bold leading-4 transition-colors",
                sort === entry ? "bg-white text-black" : "text-white/50 hover:text-white/80"
              )}
            >
              {SORT_LABEL[entry]}
            </button>
          ))}
        </div>

        {ROLE_CHIPS.map(({ role, label }) => (
          <Chip
            key={role}
            selected={filter.roles.includes(role)}
            onClick={() => onFilterChange(toggleRole(filter, role))}
          >
            {label}
          </Chip>
        ))}

        <Chip
          selected={filter.verifiedOnly}
          onClick={() => onFilterChange({ ...filter, verifiedOnly: !filter.verifiedOnly })}
        >
          Verified
        </Chip>

        {/*
          LOCATION and GENDER appear here only when a loaded profile actually
          carries them. Today `PublicProfile` carries neither, so neither is
          drawn and the sentence below says why. Nothing in this block needs
          editing when the backend ships the fields.
        */}
        {available.gender &&
          genders.map((value) => (
            <Chip
              key={value}
              selected={filter.gender.toLowerCase() === value.toLowerCase()}
              onClick={() =>
                onFilterChange({
                  ...filter,
                  gender: filter.gender.toLowerCase() === value.toLowerCase() ? "" : value,
                })
              }
            >
              {value}
            </Chip>
          ))}
      </div>

      {available.location && (
        <label className="ws-field mt-2 flex h-9 items-center gap-2 px-3.5">
          <span className="sr-only">Filter people by city or region</span>
          <input
            value={filter.location}
            onChange={(event) => onFilterChange({ ...filter, location: event.target.value })}
            /* City or region, never a distance. See `lib/people-filters.ts`. */
            placeholder="City or region"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-heading outline-none"
          />
        </label>
      )}

      {notes.length > 0 && (
        <p className="pt-2 text-[11px] leading-4 text-meta">{notes.join(" ")}</p>
      )}
    </div>
  );
}
