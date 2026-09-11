"use client";

import { Avatar } from "@/components/ui/avatar";
import { useDiscoverHouses } from "@/features/messages/lib/discover-houses";
import { useJoinGroup } from "@/features/messages";

/**
 * "JOIN A COMMUNITY" — node 258:5545, the bottom of Home.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * A 22/28 Medium heading over `Find a house you belong to or can call your own`
 * at Bold 12/16 in 40% white, then 24px, then a horizontally scrolling grid of
 * house cards laid out two rows deep.
 *
 * Each card is 427x112 at a 20px radius: `rgba(16,16,18,0.62)` behind a 7px
 * backdrop blur, ringed `rgba(255,255,255,0.18)`, 12px/16px of padding on a
 * 16px gap. Inside, read node 258:5436 exactly:
 *
 *   · an 81x88 `#FFFFFF` plate at radius 20 holding the house picture;
 *   · a 207-wide text column at gap 8, whose upper half is gap 4:
 *       - the name at Geist SemiBold 12/**14** in `#FFFFFF`;
 *       - a member row at gap 4 — three 20x20 avatars OVERLAPPING BY 8
 *         (`gap: -8px`), each `#DCDAD5` under a 1px `#FFFFFF` ring at radius
 *         100 with `0 4px 15px rgba(147,147,147,0.25)`, then the count at
 *         Geist Medium **8px** in `#FFFFFF`;
 *   · the description at Geist Regular 12/20 in `#FFFFFF`, clamped to one line;
 *   · and the `Join House` pill: 8/16 padding, gap 4, radius 100, the
 *     `#9F65FD -> #5B05E6` ramp at 90deg over a `#7E3BEB` fallback, label at
 *     Geist Medium 8 in `#FFFFFF`.
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
    <section aria-label="Communities to join" className="flex flex-col gap-6">
      <div className="flex flex-col gap-px">
        <h2 className="text-[22px] font-medium leading-7 text-white">Join a community</h2>
        <p className="text-[12px] font-bold leading-4 text-white/40">
          Find a house you belong to or can call your own
        </p>
      </div>

      {/* Two rows deep and scrolling sideways, which is what the file draws —
          `grid-flow-col` with two rows is the only layout that fills down THEN
          across, so a short list makes one full column rather than a lonely
          top row. */}
      <div className="ws-bleed-right-only -mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="grid grid-flow-col grid-rows-2 gap-6">
          {items.map((house) => (
            <article
              key={house.id}
              className="flex h-[112px] w-[427px] items-center gap-4 rounded-[20px] border border-white/[0.18] bg-[rgba(16,16,18,0.62)] px-4 py-3 backdrop-blur-[7px]"
            >
              <span className="flex h-[88px] w-[81px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-[#FFFFFF]">
                <Avatar
                  name={house.title ?? "House"}
                  seed={house.id}
                  src={house.imageUrl}
                  size={88}
                  sizeClassName="h-full w-full"
                  className="rounded-none border-0"
                />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <p className="truncate text-[12px] font-semibold leading-[14px] text-white">
                    {house.title ?? "Untitled house"}
                  </p>
                  <div className="flex items-center gap-1">
                    {/* The file stacks three faces before the count. They come
                        from the summary's own capped preview roster — never
                        fabricated, and absent when the payload carries none. */}
                    {house.members.length > 0 && (
                      <span aria-hidden className="flex items-center -space-x-2">
                        {house.members.slice(0, 3).map((member) => (
                          <span
                            key={member.id}
                            className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-white bg-[#DCDAD5] shadow-[0_4px_15px_0_rgba(147,147,147,0.25)]"
                          >
                            <Avatar
                              name={member.displayName || member.username}
                              seed={member.id}
                              src={member.avatarUrl}
                              size={20}
                              sizeClassName="h-full w-full"
                              className="rounded-none border-0"
                            />
                          </span>
                        ))}
                      </span>
                    )}
                    {/* Never "0 members": a null count means the payload does
                        not count them, which is not the same claim. */}
                    {house.memberCount !== null && (
                      <span className="tnum text-[8px] font-medium leading-none text-white">
                        {house.memberCount.toLocaleString()}{" "}
                        {house.memberCount === 1 ? "member" : "members"}
                      </span>
                    )}
                  </div>
                </div>
                {house.description && (
                  <p className="line-clamp-1 text-[12px] font-normal leading-5 text-white">
                    {house.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={join.isPending}
                onClick={() => join.mutate(house.id)}
                className="ws-press flex shrink-0 items-center gap-1 rounded-[100px] bg-[#7E3BEB] bg-[linear-gradient(90deg,#9F65FD_0%,#5B05E6_100%)] px-4 py-2 text-[8px] font-medium leading-none text-white transition-opacity hover:opacity-90 disabled:opacity-40"
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
