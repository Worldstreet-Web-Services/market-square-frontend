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
 * ─── THE CARD ────────────────────────────────────────────────────────────────
 * 356 wide in a horizontal rail, radius 22, `rgba(16,16,18,0.62)` behind a 7
 * blur, ringed INSIDE at 1 in `rgba(255,255,255,0.18)`, cards 15.7 apart. Its
 * inside is a CENTRED flex row rather than the file's absolute placement — the
 * ragged, top-anchored fixed-120 layout read as unfinished — at legible sizes:
 * a 64×68 picture, then a text column (title 15 semibold, the face pile + member
 * count at 12, a two-line 13 description), then the Join House pill on the
 * 90deg `#9F65FD -> #5B05E6` ramp (`ws-btn-welcome`). Everything lines up and
 * the card grows to its content instead of clipping inside a fixed height.
 *
 * ─── EMPTY IS ABSENT ─────────────────────────────────────────────────────────
 * A 404 means the route is not deployed and an empty list means no public house
 * exists yet; both render NOTHING. A permanent empty shelf on Home would be an
 * apology for a feature nobody can use.
 */

export function PopularHouses() {
  const houses = useDiscoverHouses(8);
  const join = useJoinGroup();

  const items = houses.data?.items ?? [];
  if (houses.unavailable || items.length === 0) return null;

  return (
    <section aria-labelledby="popular-houses" className="mb-10">
      <div className="mb-4">
        <SectionHeading
          id="popular-houses"
          lead="Popular"
          accent="Houses"
          action={{ label: "View more", href: sq("/houses") }}
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((house) => (
          // Node 1302:148763 — capped at 400 so a second card peeks, and never
          // more than 95% of the column so it fits a phone.
          <article key={house.id} className="w-100 max-w-[95%] shrink-0">
            {/* The card: the house picture, a text column that takes the slack,
                and the Join pill, all vertically centred. */}
            <div className="flex items-center gap-4 rounded-[17px] bg-[rgba(16,16,18,0.62)] px-4 py-4 shadow-[inset_0_0_0_0.766px_rgba(255,255,255,0.18)] backdrop-blur-[5.365px]">
              {/* 1302:148764 — the house picture on its white plate. */}
              <span className="h-[80px] w-[74px] shrink-0 overflow-hidden rounded-[12px] bg-white">
                <Avatar
                  name={house.title ?? "House"}
                  seed={house.id}
                  src={house.imageUrl}
                  size={80}
                  sizeClassName="h-full w-full"
                  className="rounded-none border-0"
                />
              </span>

              {/* 1302:148766 — the text column. */}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <p className="truncate text-[15px] font-semibold leading-tight text-white">
                    {house.title ?? "Untitled house"}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {/* 1302:148770 — three overlapping faces, the payload's own
                        capped roster, never invented, absent when empty. */}
                    {house.members.length > 0 && (
                      <span aria-hidden className="flex items-center">
                        {house.members.slice(0, 3).map((member, index) => (
                          <span
                            key={member.id}
                            className="flex h-[20px] w-[20px] items-center justify-center overflow-hidden rounded-full border border-white bg-[#DCDAD5] shadow-[0_2px_8px_rgba(147,147,147,0.25)]"
                            style={{ marginLeft: index === 0 ? 0 : -8 }}
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
                    {/* Never "0 members": a null count means the payload does not
                        count them, which is a different claim. */}
                    {house.memberCount !== null && (
                      <span className="tnum text-[11px] font-medium text-white/60">
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

              {/* 1302:148779 — Join House, the create ramp (90°, #9F65FD→#5B05E6). */}
              <button
                type="button"
                disabled={join.isPending}
                onClick={() => join.mutate(house.id)}
                className="ws-press shrink-0 self-center whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#9f65fd_0%,#5b05e6_100%)] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
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
