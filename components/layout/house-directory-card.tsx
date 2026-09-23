"use client";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { asset } from "@/lib/square-path";
import type { HousePreview } from "@/components/layout/house-preview-sheet";

/**
 * ONE HOUSE, DRAWN ONE WAY — Home's rail and the /houses directory both.
 *
 * They were two copies of the same object and they had drifted, which is the
 * whole reason this exists. Home's card was rebuilt at legible sizes when the
 * file's own absolute, top-anchored layout read as unfinished; the directory's
 * was left at node 1373:3367's 290 × 86 with a 10px title and an 8px Join
 * pill, and only its PHONE variant was ever corrected. So the rail looked
 * right and the page its own "View more" opens looked like a different
 * product (ogazboiz, 2026-09-23).
 *
 * The surviving shape is Home's, because it is the one that was designed
 * against real content: a 80 × 74 picture on its white plate, a text column
 * that takes the slack, and Join on the create ramp, all vertically centred
 * with 16 of padding and 16 between. The card grows to its content instead of
 * clipping inside a fixed height, which is what let a two-line description and
 * a long house name coexist.
 *
 * ─── THE BODY OPENS, THE PILL JOINS ──────────────────────────────────────────
 * Tapping the card opens the house; only the pill joins it, and it stops
 * propagation to say so. Before this the rail offered Join and nothing else,
 * so the only way to find out what a house WAS on Home was to join it and
 * look. `GET /conversations/{id}` is optional-auth and answers a public house
 * to a signed-out reader, so there was never anything owed by the service.
 */
export function HouseDirectoryCard({
  house,
  onOpen,
  onJoin,
  joining = false,
}: {
  house: HousePreview & { members: Array<{ id: string; displayName?: string | null; username: string; avatarUrl?: string | null }> };
  onOpen: () => void;
  onJoin: () => void;
  joining?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${house.title ?? "house"}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="ws-press flex h-full cursor-pointer items-center gap-4 rounded-[17px] bg-[rgba(16,16,18,0.62)] px-4 py-4 shadow-[inset_0_0_0_0.766px_rgba(255,255,255,0.18)] backdrop-blur-[5.365px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/*
        1302:148764 — the house picture on its white plate.

        A HOUSE WITH NO PICTURE GETS THE FILE'S PLATE, NOT A FACE. Home's card
        passed `imageUrl` to `Avatar`, which falls back to a SEEDED PERSON when
        there is none — so a house with no photo wore a stranger's face. The
        directory already knew better (1373:3990: a #D8D8D8 plate with the gist
        glyph centred) and its invariant says so in as many words. Unifying on
        Home's card would have carried Home's bug across; this carries the
        directory's correctness back instead.
      */}
      <span
        className={cn(
          "h-[80px] w-[74px] shrink-0 overflow-hidden rounded-[12px] bg-white",
          !house.imageUrl && "flex items-center justify-center bg-[#D8D8D8]"
        )}
      >
        {house.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- media hosts are unknown at build time */
          <img src={house.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- the node's own export */
          <img
            src={asset("/gist-rooms/card-default-cover.svg")}
            alt=""
            aria-hidden
            className="h-6 w-[32.78px]"
          />
        )}
      </span>

      {/* 1302:148766 — the text column, and the only block that gives. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-white">
            {house.title ?? "Untitled house"}
          </p>
          <div className="flex items-center gap-1.5">
            {/* 1302:148770 — three overlapping faces, the payload's own capped
                roster, never invented, absent when empty. */}
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
            {/* Never "0 members": a null count means the payload does not count
                them, which is a different claim. */}
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
        disabled={joining}
        onClick={(event) => {
          // Joining is a decision, not a look: it must not also open the sheet
          // the card body opens.
          event.stopPropagation();
          onJoin();
        }}
        className="ws-press shrink-0 self-center whitespace-nowrap rounded-full bg-[linear-gradient(90deg,#9f65fd_0%,#5b05e6_100%)] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Join House
      </button>
    </div>
  );
}
