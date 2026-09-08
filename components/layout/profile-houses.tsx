"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { IconPlus } from "@/components/ui/icons";
import { useConversations } from "@/features/messages";

/**
 * THE HOUSES ON A PROFILE — node 534:15577.
 *
 * A heading with "View All" opposite it, then a horizontal rail: an "Add new
 * house" tile at 136x112 and then each house at 427x112, all at a 20 radius
 * over `#101012` at 62% — which is `ws-panel`'s own fill, so no new surface.
 *
 * ─── OWN PROFILE ONLY, AND THAT IS THE CONTRACT'S DOING ─────────────────────
 * The list comes from `GET /me/conversations?kind=group` — the same query the
 * chat inbox's Houses tab runs, server-side. There is no route for the houses
 * SOMEBODY ELSE belongs to: `/profiles/:username` offers posts, streams and
 * activities and nothing about groups. So this renders on your own profile and
 * is absent on anyone else's, rather than showing a visitor an empty rail that
 * says nothing about the person they came to read.
 *
 * The file agrees, as it happens: the frame it sits in also carries "Add new
 * house" and "Edit Profile", which are only ever your own.
 *
 * ─── WHY IT IS COMPOSED HERE ────────────────────────────────────────────────
 * A house is a CONVERSATION, so this reads the messages slice; the profile is
 * its own slice and the two may not import each other. Assembled in the layout
 * layer and handed down, the same route-slot pattern the rest of the app uses.
 */
export function ProfileHouses() {
  const houses = useConversations("houses");
  const items = (houses.data?.pages ?? []).flatMap((page) => page.items);

  // Nothing to say yet: the rail is absent rather than a lone "Add" tile
  // floating under a heading with nothing beside it.
  if (houses.isPending || houses.isError) return null;

  return (
    <section aria-label="Houses" className="flex flex-col gap-4">
      {/* 534:17352 — 12/16 bold, and "View All" opposite it at the same size.
          Only when there is more than the rail can show at once. */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[12px] font-bold leading-4 text-grey-100">Houses</h2>
        {items.length > 0 && (
          <Link
            href="/messages?tab=houses"
            className="text-[12px] font-bold leading-4 text-white transition-opacity hover:opacity-80"
          >
            View All
          </Link>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* 534:15580 — 136 wide against the houses' 427, so it reads as a slot
            rather than as a house with nothing in it. */}
        <Link
          href="/messages?compose=house"
          className="ws-press flex h-[112px] w-[136px] shrink-0 flex-col items-center justify-center gap-2 rounded-[20px] bg-[rgba(16,16,18,0.62)] text-[12px] leading-4 text-white transition-colors hover:bg-white/[0.06]"
        >
          <IconPlus className="h-6 w-6 text-create" />
          Add new house
        </Link>

        {items.map((house) => (
          <div
            key={house.id}
            className="flex h-[112px] w-[427px] shrink-0 items-center gap-4 rounded-[20px] bg-[rgba(16,16,18,0.62)] px-4 py-3"
          >
            {/* 81x88 at a 20 radius — a portrait tile, not a square thumb. */}
            <Avatar
              name={house.title ?? "House"}
              seed={house.id}
              src={house.imageUrl}
              size={88}
              sizeClassName="h-[88px] w-[81px]"
              className="shrink-0 rounded-[20px]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="truncate text-[14px] font-bold leading-5 text-white">
                {house.title ?? "House"}
              </p>
              {/* The description is the house's own words. Absent, the line is
                  absent — the card does not invent a summary. */}
              {house.description && (
                <p className="line-clamp-2 text-[12px] leading-4 text-white/50">
                  {house.description}
                </p>
              )}
            </div>
            {/* 534:15600 — 76x26 at a 100 radius on the spotlight fill. */}
            <Link
              href={`/messages?conversation=${house.id}`}
              className="ws-press flex h-[26px] shrink-0 items-center justify-center rounded-full bg-spotlight px-4 text-[11px] font-semibold leading-4 text-white transition-opacity hover:opacity-90"
            >
              View House
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
