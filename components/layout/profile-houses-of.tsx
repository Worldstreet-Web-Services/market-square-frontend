"use client";

import { HouseCard } from "@/components/layout/house-card";
import { useJoinGroup, useProfileHouses } from "@/features/messages";
import { useAuth } from "@/hooks/use-auth";
import { useGate } from "@/hooks/use-gate";

/**
 * THE HOUSES SOMEBODY ELSE BELONGS TO — node 545:47653 on a stranger's
 * profile: the heading "House", 16, then a horizontal rail of the same
 * 427x112 card the own-profile rail draws, 16 apart. No "Add new house" tile:
 * that is only ever yours.
 *
 * The list is `GET /profiles/:username/houses`, read through the messages
 * slice (`useProfileHouses`), which owns the house shape. The rail is absent
 * — heading included — while the route is not deployed or answers nothing.
 *
 * ─── THE ONE DECISION ON THE CARD ───────────────────────────────────────────
 * 545:47691 "View House" when `viewerIsMember === true`, otherwise 545:47673
 * "Join House" behind the sign-in gate (`POST /conversations/:id/join`).
 *
 * For an ANONYMOUS reader `viewerIsMember` is omitted, and "Join House" is a
 * sign-in invitation, not a finding that they are outside: it may become
 * View House the moment they sign in, which is why the read's key carries the
 * session. The pill says so in its accessible name — "Sign in to join" — and
 * nothing here turns the missing field into a "no".
 *
 * Composed here rather than inside either slice because it reads the
 * messages slice (the list, the join) for the profile's page.
 */
export function ProfileHousesOf({ username }: { username: string }) {
  const houses = useProfileHouses(username);
  const join = useJoinGroup();
  const gate = useGate();
  const { authenticated } = useAuth();

  const items = houses.data?.items ?? [];
  if (houses.isPending || houses.isError || houses.unavailable || items.length === 0) return null;

  return (
    <section aria-label="Houses" className="flex flex-col gap-4">
      {/* 545:47654 — "House", Roboto Bold 12/16 in `#F4F4F4` (`--color-grey-100`),
          set in Geist 700 like every other heading in the app. */}
      <h2 className="text-[12px] font-bold leading-4 text-grey-100">House</h2>
      <div className="flex items-center gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((house) => (
          <HouseCard
            key={house.id}
            id={house.id}
            name={house.title ?? "House"}
            imageUrl={house.imageUrl}
            description={house.description}
            members={house.members}
            memberCount={house.memberCount}
            action={
              house.viewerIsMember === true
                ? { label: "View House", href: `/messages?conversation=${house.id}` }
                : {
                    label: "Join House",
                    title: authenticated ? undefined : "Sign in to join",
                    onClick: () => gate(() => join.mutate(house.id)),
                    disabled: join.isPending,
                  }
            }
          />
        ))}
      </div>
    </section>
  );
}
