"use client";

import { PalCard, RAIL_CARD } from "@/components/layout/pal-card";
import { usePeople } from "@/features/discovery";
import { useMe } from "@/hooks/use-me";
import type { Profile } from "@/lib/api/schemas";

/** How many the rail asks for. The file draws twelve and clips at six. */
const WANTED = 12;

/**
 * "SUGGESTED PALS TO FOLLOW NEARBY YOU" — node 540:19351.
 *
 * A horizontal rail of pal cards a few posts into the timeline. Same card as
 * "Make some friends" (`PalCard`), laid flat instead of fanned: 170.41 wide on
 * a 12 gap, headed by a 19.53/24.86 title and a 10.65/14.21 line at 40% white,
 * 18.11 above the cards.
 *
 * The file draws twelve cards in a 1085 window that shows six. That is a rail
 * you scroll, not a grid, so it scrolls — and it scrolls with the column rather
 * than being clipped to a fixed width, because our column is not 1085.
 *
 * ─── "NEARBY" IS A PLACE NAME, NEVER A DISTANCE ─────────────────────────────
 * It asks `GET /profiles?city=<the viewer's own city>`. There is no radius, no
 * coordinate and no `distanceKm` anywhere in this path and there must not be:
 * a city somebody typed about themselves is a fact they chose to publish, while
 * a distance to a stranger is their position, recomputed every time you look.
 * `lib/people-filters.ts` carries the same rule for Explore's filters.
 *
 * ─── IT RENDERS NOTHING UNTIL IT CAN HONESTLY SAY "NEARBY" ──────────────────
 * With no city on the viewer's own profile there is no place to ask about, and
 * the rail is absent rather than quietly showing a general list under a heading
 * that promises a local one. Dropping the facet would not be graceful
 * degradation, it would be the section lying about what it is.
 *
 * (`GET /me` does carry `city`: the spec's `Profile` is an `allOf` over
 * `PublicProfile` plus the private half, so reading its own `properties` finds
 * nothing while city, region and gender are inherited. Worth knowing before
 * concluding a field is missing from this API.)
 *
 * `excludeFollowing=true` keeps people the viewer already follows out of a rail
 * whose whole proposition is people to follow. Server-side, because filtering
 * the loaded page here costs a row per page that no cursor can top back up.
 */
export function SuggestedPals() {
  const me = useMe();
  const city = me.data?.city?.trim() ?? "";
  const people = usePeople("", "followers", Boolean(city), { city, excludeFollowing: true });

  const items: Profile[] = (people.data?.pages ?? [])
    .flatMap((page) => page.items)
    .slice(0, WANTED);

  // No place to ask about, nothing worth showing, or the request failed: the
  // rail is a suggestion, so it costs the reader nothing to be absent and a
  // skeleton for a section nobody asked for is worse than silence.
  if (!city || items.length === 0) return null;

  return (
    <section aria-label="Suggested pals to follow nearby you">
      <h2 className="text-[19.5px] font-medium leading-[24.9px] text-white">
        Suggested Pals to follow nearby you
      </h2>
      {/* 10.65/14.21 at 40% white, and BOLD — the file sets the small line
          heavier than the title it sits under, which is unusual enough to be
          worth saying out loud. */}
      <p className="mt-[0.9px] text-[10.65px] font-bold leading-[14.2px] text-white/40">
        Wink at them or follow them later.
      </p>
      {/*
        `-mx-*` then padding: the rail runs to the card's edges as the file
        draws it, but its first and last cards keep the column's own inset, so
        nothing is flush against the border when it is scrolled to either end.
        `overflow-x-auto` clips BOTH axes, so the cards' shadows are not part of
        this box — they are inside the card's own bounds.
      */}
      <div className="mt-[18px] flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((profile) => (
          <PalCard key={profile.id} profile={profile} geometry={RAIL_CARD} />
        ))}
      </div>
    </section>
  );
}
