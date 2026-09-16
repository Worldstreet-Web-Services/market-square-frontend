"use client";

import { Avatar } from "@/components/ui/avatar";
import { SectionHeading } from "@/components/layout/section-heading";
import { useDiscoverHouses } from "@/features/messages/lib/discover-houses";
import { useJoinGroup } from "@/features/messages";
import { sq } from "@/lib/square-path";

/**
 * POPULAR HOUSES — node 1305:149179 in the 2026-09-12 Home.
 *
 * This REPLACES "Join a community" rather than joining it: same endpoint, same
 * card, same Join button, a new heading and a new size. Two sections against
 * one list would be the duplication ogazboiz warned about ("if we dont have
 * then do it to avoid duplicate"), and the backend confirmed the endpoint is
 * already the ranked directory this section wants.
 *
 * ─── WHY THE LIST IS ALREADY "POPULAR" ───────────────────────────────────────
 * `GET /conversations/discover` is ordered by MEMBER COUNT descending (ties by
 * id) and excludes houses the reader is already in — a Join House button on a
 * house you belong to is the bug that ordering was written to avoid. It is
 * public with optional auth, so this section works signed out. Nothing is
 * re-sorted here: sorting one loaded page is not sorting the list.
 *
 * ─── THE FILE'S NUMBERS ──────────────────────────────────────────────────────
 * Every value divides by the frame's own 0.7664 hairline to the card's true
 * size, the same way the upcoming card does, so `--u` is 1/356th of the card's
 * width and the whole composition scales as one piece:
 *
 *   · the card 356 x 120, radius 22, `rgba(16,16,18,0.62)` behind a 7 blur,
 *     ringed INSIDE at 1 in `rgba(255,255,255,0.18)`; cards 15.7 apart;
 *   · the picture 65.1 x 70.7 at (19.6, 30), radius 16.08, on white;
 *   · a 166.4-wide text column at (97.5, 30.3), gap 6.43 / inner 3.22:
 *       - the name at Geist SemiBold 9.65/11.25;
 *       - three 16.07 avatars OVERLAPPING BY 6.43, each `#DCDAD5` under a 0.8
 *         white ring with `0 3.2 12 rgba(147,147,147,0.25)`, then the count at
 *         Geist Medium 6.43;
 *       - the description at Geist Regular 9.65/16.07, two lines;
 *   · the Join House pill at (276.8, 55), padding 6.43/12.86, radius 80, on the
 *     90deg `#9F65FD -> #5B05E6` ramp over `#7E3BEB`, label Geist Medium 6.43.
 *
 * ─── EMPTY IS ABSENT ─────────────────────────────────────────────────────────
 * A 404 means the route is not deployed and an empty list means no public house
 * exists yet; both render NOTHING. A permanent empty shelf on Home would be an
 * apology for a feature nobody can use.
 */

/** One design unit — 1/356th of the card's own width. */
const u = (n: number) => `calc(${n}*var(--u))`;

export function PopularHouses() {
  const houses = useDiscoverHouses(8);
  const join = useJoinGroup();

  const items = houses.data?.items ?? [];
  if (houses.unavailable || items.length === 0) return null;

  return (
    <section aria-labelledby="popular-houses" className="mb-[64px]">
      <div className="mb-4">
        <SectionHeading
          id="popular-houses"
          lead="Popular"
          accent="Houses"
          action={{ label: "View more", href: sq("/houses") }}
        />
      </div>

      <div className="flex gap-[15.7px] overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((house) => (
          <article
            key={house.id}
            className="@container relative w-[356px] shrink-0"
          >
            <div
              className="relative overflow-hidden bg-[rgba(16,16,18,0.62)]"
              style={
                {
                  "--u": "calc(100cqw / 356)",
                  height: u(120),
                  borderRadius: u(22),
                  boxShadow: `inset 0 0 0 ${u(1)} rgba(255,255,255,0.18)`,
                  backdropFilter: `blur(${u(7)})`,
                } as React.CSSProperties
              }
            >
              {/* 1302:148764 — the house picture on its white plate. */}
              <span
                className="absolute overflow-hidden bg-white"
                style={{ left: u(19.6), top: u(30), width: u(65.1), height: u(70.7), borderRadius: u(16.08) }}
              >
                <Avatar
                  name={house.title ?? "House"}
                  seed={house.id}
                  src={house.imageUrl}
                  size={71}
                  sizeClassName="h-full w-full"
                  className="rounded-none border-0"
                />
              </span>

              {/* 1302:148766 — the text column. */}
              <div
                className="absolute flex flex-col"
                style={{ left: u(97.5), top: u(30.3), width: u(166.4), gap: u(6.43) }}
              >
                <div className="flex flex-col" style={{ gap: u(3.22) }}>
                  <p
                    className="truncate font-semibold text-white"
                    style={{ fontSize: u(9.65), lineHeight: u(11.25) }}
                  >
                    {house.title ?? "Untitled house"}
                  </p>
                  <div className="flex items-center" style={{ gap: u(3.22) }}>
                    {/* The file stacks three faces. They come from the payload's
                        own capped roster — never invented, absent when empty. */}
                    {house.members.length > 0 && (
                      <span aria-hidden className="flex items-center" style={{ marginRight: u(3.22) }}>
                        {house.members.slice(0, 3).map((member, index) => (
                          <span
                            key={member.id}
                            className="flex items-center justify-center overflow-hidden rounded-[25%] bg-[#DCDAD5]"
                            style={{
                              width: u(16.07),
                              height: u(16.07),
                              marginLeft: index === 0 ? 0 : u(-6.43),
                              boxShadow: `inset 0 0 0 ${u(0.8)} #FFFFFF, 0 ${u(3.2)} ${u(12)} rgba(147,147,147,0.25)`,
                            }}
                          >
                            <Avatar
                              name={member.displayName || member.username}
                              seed={member.id}
                              src={member.avatarUrl}
                              size={16}
                              sizeClassName="h-full w-full"
                              className="rounded-none border-0"
                            />
                          </span>
                        ))}
                      </span>
                    )}
                    {/* Never "0 members": a null count means the payload does
                        not count them, which is a different claim. */}
                    {house.memberCount !== null && (
                      <span className="tnum font-medium text-white" style={{ fontSize: u(6.43) }}>
                        {house.memberCount.toLocaleString()}{" "}
                        {house.memberCount === 1 ? "member" : "members"}
                      </span>
                    )}
                  </div>
                </div>
                {house.description && (
                  <p
                    className="line-clamp-2 font-normal text-white"
                    style={{ fontSize: u(9.65), lineHeight: u(16.07) }}
                  >
                    {house.description}
                  </p>
                )}
              </div>

              {/* 1302:148779 — Join House. */}
              <button
                type="button"
                disabled={join.isPending}
                onClick={() => join.mutate(house.id)}
                className="ws-press absolute flex items-center font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{
                  left: u(276.8),
                  top: u(55),
                  padding: `${u(6.43)} ${u(12.86)}`,
                  borderRadius: u(80),
                  background: "linear-gradient(90deg,#9F65FD 0%,#5B05E6 100%), #7E3BEB",
                  fontSize: u(6.43),
                }}
              >
                Join House
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
