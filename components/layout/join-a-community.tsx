"use client";

import { Avatar } from "@/components/ui/avatar";
import { useDiscoverHouses } from "@/features/messages/lib/discover-houses";
import { useJoinGroup } from "@/features/messages";

/**
 * "JOIN A COMMUNITY" — node 647:16515 in the live file (647:16288, updated
 * 2026-09-10), between the second and third posts of Home's timeline.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * A Medium 32/28.61 heading over `Find a house you belong to or can call your
 * own` at Bold 12.26/16.35 in 40% white, then 24.53, then house cards two rows
 * deep, 14.14 apart both ways. Its column is wider than ours, so where the file
 * fits two across, ours scrolls sideways; the cards keep the file's size.
 *
 * Each card (647:16521) is 432.18x113.36 at a 20.24 radius: `rgba(16,16,18,
 * 0.62)` behind a 14.17 background blur (7.08 in CSS), ringed INSIDE at 1.01 in
 * `rgba(255,255,255,0.18)`, 16.19/12.15 of padding on a 16.19 gap. Inside:
 *
 *   · an 81.98x89.07 `#FFFFFF` plate at radius 20.24 holding the house picture;
 *   · a 209.51-wide text column at gap 8.1, whose upper half is gap 4.05:
 *       - the name at Geist SemiBold 12.15/14.17 in `#FFFFFF`;
 *       - a member row at gap 4.05 — three 20.24 avatars OVERLAPPING BY 8.1,
 *         each `#DCDAD5` under a 1.01 inside `#FFFFFF` ring with
 *         `0 4.05 15.18 rgba(147,147,147,0.25)`, then the count at Geist
 *         Medium 8.1/10.53;
 *   · the description at Geist Regular 12.15/20.24, TWO lines, as the file's
 *     41-tall box draws it;
 *   · and the `Join House` pill: 8.1/16.19 padding, radius 100, the
 *     `#9F65FD -> #5B05E6` ramp at 90deg over `#7E3BEB`, label at Geist
 *     Medium 8.1/10.53.
 *
 * ─── IT SHOWS PUBLIC GROUPS, AND NOTHING WHEN THERE ARE NONE ─────────────────
 * `GET /conversations/discover` is live (though undocumented — see the hook).
 * It lists groups whose `visibility` is `public`, which is a choice made in the
 * group composer at creation; a `private` group is reachable only by invitation
 * and correctly never appears here.
 *
 * The section renders NOTHING when the list is empty or the route is not
 * deployed. A permanent empty "Join a community" panel on Home would be an
 * apology for a feature nobody can use yet; an absent section is simply the
 * page as it is, and it fills itself the moment a public group exists.
 */
export function JoinACommunity() {
  const houses = useDiscoverHouses(6);
  const join = useJoinGroup();

  const items = houses.data?.items ?? [];
  // Absent, not empty: see the note above.
  if (houses.unavailable || items.length === 0) return null;

  return (
    <section aria-label="Communities to join" className="flex flex-col gap-[24.53px]">
      <div className="flex flex-col gap-[1.02px]">
        <h2 className="text-[32px] font-medium leading-[28.61px] text-white">Join a community</h2>
        <p className="text-[12.26px] font-bold leading-[16.35px] text-white/40">
          Find a house you belong to or can call your own
        </p>
      </div>

      {/* Two rows deep and scrolling sideways, which is what the file draws —
          `grid-flow-col` with two rows is the only layout that fills down THEN
          across, so a short list makes one full column rather than a lonely
          top row. With ONE house there is no second row to fill, and asking
          for two left 113px of empty card-shaped space under it on a phone
          (ogazboiz, 2026-09-18: "the card was too long"), so a single house
          gets a single row. */}
      {/* Scrolls sideways WITHIN the column — no `-mx` bleed, which pushed the
          rail wider than the feed column and overflowed on a phone. */}
      <div className="-mr-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={`grid grid-flow-col gap-[14.14px] ${items.length > 1 ? "grid-rows-2" : "grid-rows-1"}`}>
          {items.map((house) => (
            <article
              key={house.id}
              className="flex h-[113.36px] w-[88vw] max-w-100 items-center gap-3 rounded-[20.24px] bg-[rgba(16,16,18,0.62)] px-4 py-[12.15px] shadow-[inset_0_0_0_1.01px_rgba(255,255,255,0.18)] backdrop-blur-[7.08px]"
            >
              <span className="flex h-[89.07px] w-[81.98px] shrink-0 items-center justify-center overflow-hidden rounded-[20.24px] bg-[#FFFFFF]">
                <Avatar
                  name={house.title ?? "House"}
                  seed={house.id}
                  src={house.imageUrl}
                  size={89}
                  sizeClassName="h-full w-full"
                  className="border-0 rounded-none"
                />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-col gap-1">
                  <p className="truncate text-[15px] font-semibold leading-tight text-white">
                    {house.title ?? "Untitled house"}
                  </p>
                  <div className="flex items-center gap-[4.05px]">
                    {/* The file stacks three faces before the count. They come
                        from the summary's own capped preview roster — never
                        fabricated, and absent when the payload carries none. */}
                    {house.members.length > 0 && (
                      <span aria-hidden className="flex items-center -space-x-[8.1px]">
                        {house.members.slice(0, 3).map((member) => (
                          <span
                            key={member.id}
                            className="flex h-[20.24px] w-[20.24px] items-center justify-center overflow-hidden rounded-full bg-[#DCDAD5] shadow-[inset_0_0_0_1.01px_#FFFFFF,0_4.05px_15.18px_0_rgba(147,147,147,0.25)]"
                          >
                            <Avatar
                              name={member.displayName || member.username}
                              seed={member.id}
                              src={member.avatarUrl}
                              size={20}
                              sizeClassName="h-full w-full"
                              className="border-0 rounded-none"
                            />
                          </span>
                        ))}
                      </span>
                    )}
                    {/* Never "0 members": a null count means the payload does
                        not count them, which is not the same claim. */}
                    {house.memberCount !== null && (
                      <span className="tnum text-[12px] font-medium text-white/60">
                        {house.memberCount.toLocaleString()}{" "}
                        {house.memberCount === 1 ? "member" : "members"}
                      </span>
                    )}
                  </div>
                </div>
                {house.description && (
                  <p className="line-clamp-2 text-[13px] font-normal leading-snug text-white/70">
                    {house.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={join.isPending}
                onClick={() => join.mutate(house.id)}
                className="ws-press flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-spotlight bg-[linear-gradient(90deg,#9F65FD_0%,#5B05E6_100%)] px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Join House
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
