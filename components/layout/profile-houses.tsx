"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { useConversations } from "@/features/messages";
import type { Profile } from "@/lib/api/schemas";

/**
 * THE HOUSES ON A PROFILE — nodes 534:16949 (the section) and 534:16951 (the
 * rail). A heading, 16, then a horizontal rail of 112-tall cards 16 apart: an
 * "Add new house" tile at 136 and each house at 427.
 *
 * ─── THE CARD IS AN OUTLINE, NOT A FILL ─────────────────────────────────────
 * Every card — the Add tile included — carries `#FFFFFF` at 18% as a 1px
 * STROKE over the `#101012`/62% fill. It shipped with the fill alone, so the
 * cards dissolved into the page: sampling the export's card edge gives
 * (59,59,60) against a (15,15,16) interior, which is exactly 18% white
 * composited over that fill. The border is what makes the rail read as five
 * objects rather than one dark band.
 *
 * ─── OWN PROFILE ONLY, AND THAT IS THE CONTRACT'S DOING ─────────────────────
 * The list comes from `GET /me/conversations?kind=group` — the same query the
 * chat inbox's Houses tab runs. There is no route for the houses SOMEBODY ELSE
 * belongs to, so this renders on your own profile and is absent on anyone
 * else's rather than showing a visitor an empty rail.
 *
 * The file agrees: the frame it sits in also carries "Add new house", which is
 * only ever your own.
 *
 * ─── WHY IT IS COMPOSED HERE ────────────────────────────────────────────────
 * A house is a CONVERSATION, so this reads the messages slice; the profile is
 * its own slice and the two may not import each other.
 */

/** The one card surface, stated once — the Add tile and a house share it. */
const CARD = "shrink-0 rounded-[20px] border border-white/[0.18] bg-[rgba(16,16,18,0.62)]";

/**
 * The members line — node 534:16962.
 *
 * Three 20px discs overlapping by 8 (`itemSpacing: -8`), each ringed in solid
 * white so the stack reads as separate faces, then the count 4 away.
 *
 * BOTH HALVES ARE OPTIONAL AND NEITHER IS INVENTED. `members` is the service's
 * preview roster, capped at four upstream; `memberCount` is nullable ON
 * PURPOSE, because absent means "this payload does not count members" and not
 * "this house has none" — so a missing count prints nothing rather than
 * "0 members". With neither, the line is absent and the title sits straight
 * above the description.
 */
function MemberLine({ members, count }: { members: Profile[]; count: number | null }) {
  // The file draws three; the payload may carry four.
  const faces = members.slice(0, 3);
  if (faces.length === 0 && count === null) return null;
  return (
    <div className="flex items-center gap-1">
      {faces.length > 0 && (
        <div className="flex items-center -space-x-2">
          {faces.map((person) => (
            <Avatar
              key={person.id}
              name={person.displayName || person.username}
              seed={person.id}
              src={person.avatarUrl}
              size={20}
              className="rounded-full ring-1 ring-white"
            />
          ))}
        </div>
      )}
      {count !== null && (
        <span className="tnum text-[8px] font-medium leading-[10.4px] text-white">
          {count.toLocaleString()} {count === 1 ? "member" : "members"}
        </span>
      )}
    </div>
  );
}

export function ProfileHouses() {
  const houses = useConversations("houses");
  const items = (houses.data?.pages ?? []).flatMap((page) => page.items);

  // Nothing to say yet: the rail is absent rather than a lone "Add" tile
  // floating under a heading with nothing beside it.
  if (houses.isPending || houses.isError) return null;

  return (
    <section aria-label="Houses" className="flex flex-col gap-4">
      {/* 534:16950 — 12/16 at 700 in `#F4F4F4`, which is `--color-grey-100`
          exactly. It spans the full 741 and has NOTHING opposite it: the
          section's only children are this line and the rail, so the "View All"
          that used to sit here is gone. It cost nothing — the rail scrolls and
          already holds every house. */}
      <h2 className="text-[12px] font-bold leading-4 text-grey-100">Houses</h2>

      <div className="flex items-center gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* 534:16952 — 136 wide against the houses' 427, so it reads as a slot
            rather than as a house with nothing in it.

            The `+` is TYPE, not an icon: Geist 600 at 41.6/62.4, and the label
            is pulled 12 back into it (`itemSpacing: -12`) so the two read as
            one mark. Its measured fill is `#9F5AFF`; painted with
            `--color-create` `#9F65FD`, the ramp's light stop, because the two
            are a hair apart and this repo deliberately keeps two purples. */}
        <Link
          href="/messages?compose=house"
          className={`${CARD} ws-press flex h-[112px] w-[136px] flex-col items-center justify-center px-4 py-3 transition-colors hover:bg-white/[0.06]`}
        >
          <span aria-hidden className="text-[41.6px] font-semibold leading-[62.4px] text-create">
            +
          </span>
          <span className="-mt-3 text-[13.82px] font-semibold leading-[20.73px] text-grey-400">
            Add new house
          </span>
        </Link>

        {items.map((house) => (
          <div key={house.id} className={`${CARD} flex h-[112px] w-[427px] items-center gap-4 px-4 py-3`}>
            {/* 534:16957 — 81x88 at a 20 radius, and it CLIPS: the artwork
                inside it is 132 wide against the frame's 81, so the picture is
                cropped by the frame rather than squashed into it. */}
            <Avatar
              name={house.title ?? "House"}
              seed={house.id}
              src={house.imageUrl}
              size={88}
              sizeClassName="h-[88px] w-[81px]"
              className="shrink-0 overflow-hidden rounded-[20px]"
            />

            {/* 534:16959 — 8 between the block above and the description,
                4 between the title and the members line inside it. */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-[12px] font-semibold leading-[14px] text-white">
                  {house.title ?? "House"}
                </p>
                <MemberLine members={house.members} count={house.memberCount} />
              </div>

              {/* 534:16971 — 12/20 at 400 in FULL white, two lines. It shipped
                  at 50%, which the render refutes: the description's brightest
                  pixel is (255,255,255), the same as the title's. The house's
                  own words, so no line at all when there are none. */}
              {house.description && (
                <p className="line-clamp-2 text-[12px] leading-5 text-white">{house.description}</p>
              )}
            </div>

            {/* 534:16972 — 76x26 at a full round, 16/8 of padding, label at
                Geist 500 8/10.4. Its fill is TWO stacked layers: a `#7E3BEB`
                solid under an opaque `90deg` gradient, so only the gradient is
                ever seen — and its stops are `#9F65FD` -> `#5B05E6`, which are
                `--color-create` and `--color-create-deep` to the byte. That is
                `ws-btn-welcome`, the existing 90deg utility for exactly this
                pair; `ws-btn-create` is the same two stops at 155deg and would
                have been the wrong axis. */}
            <Link
              href={`/messages?conversation=${house.id}`}
              className="ws-btn-welcome ws-press flex h-[26px] shrink-0 items-center justify-center rounded-full px-4 text-[8px] font-medium leading-[10.4px] text-white transition-opacity hover:opacity-90"
            >
              View House
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
